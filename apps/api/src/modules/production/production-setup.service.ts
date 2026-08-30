import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryItemClass,
  InventoryTracking,
  Prisma,
} from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { skuPrefixForItemClass } from '../../common/helpers/inventory-lifecycle.util';
import { nextSkuFromExisting } from '../../common/helpers/inventory-category.util';
import {
  behaviorFromFlags,
  behaviorProduces,
  flagsFromBehaviorWithConsume,
  isStageInventoryBehavior,
  itemClassForBehavior,
  type StageInventoryBehavior,
} from '../../common/helpers/inventory-stage-behavior.util';
import { WorkflowVersionService } from './workflow/workflow-version.service';
import { resolveProductStageOutput } from './product-inventory-output.resolver';
import { validateProductionSetup, type SetupStageInput } from './production-setup.validator';
import type { BomDefaults } from '../../common/helpers/order-costing.util';
import { canonicalInventoryImageUrl } from '../inventory/inventory-image';
import { normalizePieceLabels, isPackagingStageCode, isInspectionStageCode, isDeliveryStageCode, type PieceLabel } from './piece-labels';

export type ProductionSetupStagePut = {
  workflowNodeId: string;
  stageDefinitionId: string;
  behavior: StageInventoryBehavior;
  consumesRawMaterials?: boolean;
  consumesSemiFinished?: boolean;
  outputNameEn?: string | null;
  outputNameAr?: string | null;
  outputNameHe?: string | null;
  outputQtyPerUnit?: number | null;
  expectedPieceCount?: number | null;
  pieceLabels?: Array<{
    nameEn?: string;
    nameAr?: string | null;
    nameHe?: string | null;
  }> | null;
  unit?: string | null;
  defaultWarehouseId?: string | null;
  consumeOutputIds?: string[];
  consumeWorkflowNodeIds?: string[];
  materialInputs?: Array<{
    sku?: string;
    inventoryItemId?: string;
    qtyPerUnit: number;
    unit?: string;
    required?: boolean;
  }>;
};

@Injectable()
export class ProductionSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: WorkflowVersionService,
  ) {}

  async getSetup(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, archivedAt: null },
    });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });

    const [config, outputs, inputs, materialInputs, warehouses, materials, inventoryItems] =
      await Promise.all([
      this.prisma.productWorkflowConfiguration.findUnique({
        where: { productId },
        include: {
          workflow: { include: { activeVersion: true } },
          stageOverrides: true,
        },
      }),
      this.prisma.productStageInventoryOutput.findMany({
        where: { productId },
        include: { inventoryItem: true, defaultWarehouse: true },
      }),
      this.prisma.productStageInventoryInput.findMany({ where: { productId } }),
      this.prisma.productStageMaterialInput.findMany({
        where: { productId },
        include: {
          inventoryItem: {
            select: {
              id: true,
              sku: true,
              unit: true,
              imageUrl: true,
              nameEn: true,
              nameAr: true,
            },
          },
        },
      }),
      this.prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.material.findMany({
        where: { archivedAt: null },
        select: { sku: true },
      }),
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null },
        select: {
          sku: true,
          imageUrl: true,
          nameEn: true,
          nameAr: true,
          nameHe: true,
          unit: true,
        },
      }),
    ]);

    const knownSkus = new Set([
      ...materials.map((m) => m.sku),
      ...inventoryItems.map((i) => i.sku),
    ]);
    const itemBySku = new Map(inventoryItems.map((i) => [i.sku, i]));
    const bom = (product.bomDefaults ?? null) as BomDefaults | null;
    const bomLines = (bom?.materials ?? []).map((line) => {
      const item = line.sku ? itemBySku.get(line.sku) : undefined;
      return {
        sku: line.sku ?? '',
        qty: Number(line.qty) || 0,
        exists: Boolean(line.sku && knownSkus.has(line.sku)),
        imageUrl: item ? canonicalInventoryImageUrl(item) : null,
        nameEn: item?.nameEn ?? null,
        nameAr: item?.nameAr ?? null,
        nameHe: item?.nameHe ?? null,
        unit: item?.unit ?? 'pcs',
      };
    });

    const workflow = config?.workflow ?? null;
    const versionId = workflow?.activeVersionId ?? workflow?.activeVersion?.id ?? null;
    const compiled = versionId
      ? await this.versions.compileForProductReport(versionId, productId)
      : null;

    const overrideByNode = new Map(
      (config?.stageOverrides ?? []).map((o) => [o.workflowNodeId ?? o.stageDefinitionId, o]),
    );
    const outputByNode = new Map(
      outputs.filter((o) => o.workflowNodeId).map((o) => [o.workflowNodeId as string, o]),
    );
    const inputsByNode = new Map<string, typeof inputs>();
    for (const input of inputs) {
      const key = input.workflowNodeId ?? '';
      const list = inputsByNode.get(key) ?? [];
      list.push(input);
      inputsByNode.set(key, list);
    }
    const materialsByNode = new Map<string, typeof materialInputs>();
    for (const row of materialInputs) {
      const key = row.workflowNodeId ?? '';
      const list = materialsByNode.get(key) ?? [];
      list.push(row);
      materialsByNode.set(key, list);
    }

    const includedNodes = compiled?.included ?? [];
    const workflowNodeIdByKey = new Map(
      includedNodes.map((n) => [n.nodeKey, n.sourceWorkflowNodeId]),
    );
    const edges = compiled?.edges ?? [];

    function ancestorWorkflowNodeIds(targetNodeKey: string): Set<string> {
      const ancestorKeys = new Set<string>();
      const stack = [targetNodeKey];
      const visited = new Set<string>();
      while (stack.length) {
        const cur = stack.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const e of edges) {
          if (e.toNodeKey !== cur) continue;
          if (ancestorKeys.has(e.fromNodeKey)) continue;
          ancestorKeys.add(e.fromNodeKey);
          stack.push(e.fromNodeKey);
        }
      }
      ancestorKeys.delete(targetNodeKey);
      const ids = new Set<string>();
      for (const key of ancestorKeys) {
        const id = workflowNodeIdByKey.get(key);
        if (id) ids.add(id);
      }
      return ids;
    }

    const stages = includedNodes.map((node) => {
      const productRow = outputByNode.get(node.sourceWorkflowNodeId);
      const resolved = resolveProductStageOutput(
        {
          sourceWorkflowNodeId: node.sourceWorkflowNodeId,
          stageDefinitionId: node.stageDefinitionId,
          inventoryTracking: node.inventoryTracking,
          consumesRawMaterials: node.consumesRawMaterials,
          consumesSemiFinished: node.consumesSemiFinished,
          outputQtyPerUnit: node.outputQtyPerUnit,
          outputNameAr: node.outputNameAr,
          outputNameEn: node.outputNameEn,
          outputNameHe: node.outputNameHe,
          defaultWarehouseId: node.defaultWarehouseId,
        },
        outputs,
      );
      const behavior = behaviorFromFlags({
        inventoryTracking: resolved.tracking,
        consumesRawMaterials: resolved.consumesRawMaterials,
        consumesSemiFinished: resolved.consumesSemiFinished,
      });
      const consumeOutputIds = (inputsByNode.get(node.sourceWorkflowNodeId) ?? []).map(
        (row) => row.outputId,
      );
      const override = overrideByNode.get(node.sourceWorkflowNodeId);
      const predecessorIds = ancestorWorkflowNodeIds(node.nodeKey);
      return {
        workflowNodeId: node.sourceWorkflowNodeId,
        nodeKey: node.nodeKey,
        stageDefinitionId: node.stageDefinitionId,
        stageCode: node.stageCode,
        nameEn: node.nameEn,
        nameAr: node.nameAr,
        nameHe: node.nameHe,
        isRequired: node.isRequired,
        isExcluded: false,
        requiresInspection: node.requiresInspection,
        applicability: override?.applicability ?? 'INHERIT',
        sortOrder: node.sortOrder,
        displayX: node.displayX,
        displayY: node.displayY,
        behavior,
        consumesRawMaterials: resolved.consumesRawMaterials,
        consumesSemiFinished: resolved.consumesSemiFinished,
        output: productRow
          ? {
              id: productRow.id,
              nameEn:
                productRow.itemClass === InventoryItemClass.FINISHED_GOOD
                  ? product.nameEn
                  : productRow.outputNameEn,
              nameAr:
                productRow.itemClass === InventoryItemClass.FINISHED_GOOD
                  ? product.nameAr
                  : productRow.outputNameAr,
              nameHe:
                productRow.itemClass === InventoryItemClass.FINISHED_GOOD
                  ? product.nameHe
                  : productRow.outputNameHe,
              qtyPerUnit: Number(productRow.outputQtyPerUnit),
              expectedPieceCount: productRow.expectedPieceCount ?? 1,
              pieceLabels: normalizePieceLabels(productRow.pieceLabels),
              unit: productRow.unit,
              defaultWarehouseId: productRow.defaultWarehouseId,
              inventoryItemId: productRow.inventoryItemId,
              itemClass: productRow.itemClass,
            }
          : resolved.produces
            ? {
                id: resolved.outputDefinitionId,
                nameEn:
                  resolved.itemClass === InventoryItemClass.FINISHED_GOOD
                    ? product.nameEn
                    : resolved.nameEn,
                nameAr:
                  resolved.itemClass === InventoryItemClass.FINISHED_GOOD
                    ? product.nameAr
                    : resolved.nameAr,
                nameHe:
                  resolved.itemClass === InventoryItemClass.FINISHED_GOOD
                    ? product.nameHe
                    : resolved.nameHe,
                qtyPerUnit: resolved.qtyPerUnit,
                expectedPieceCount: resolved.expectedPieceCount,
                pieceLabels: resolved.pieceLabels,
                unit: resolved.unit,
                defaultWarehouseId: resolved.warehouseId,
                inventoryItemId: resolved.inventoryItemId,
                itemClass: resolved.itemClass,
              }
            : null,
        consumeOutputIds,
        materialInputs: (materialsByNode.get(node.sourceWorkflowNodeId) ?? []).map((row) => ({
          id: row.id,
          inventoryItemId: row.inventoryItemId,
          sku: row.inventoryItem.sku,
          nameEn: row.inventoryItem.nameEn,
          nameAr: row.inventoryItem.nameAr,
          qtyPerUnit: Number(row.qtyPerUnit),
          unit: row.unit,
          required: row.required,
          imageUrl: canonicalInventoryImageUrl(row.inventoryItem),
        })),
        upstreamOutputs: outputs
          .filter(
            (o) =>
              o.workflowNodeId &&
              predecessorIds.has(o.workflowNodeId) &&
              (o.inventoryTracking === InventoryTracking.PRODUCES_SEMI_FINISHED ||
                o.itemClass === InventoryItemClass.SEMI_FINISHED_GOOD),
          )
          .map((o) => ({
            id: o.id,
            workflowNodeId: o.workflowNodeId,
            nameEn: o.outputNameEn,
            nameAr: o.outputNameAr,
            nameHe: o.outputNameHe,
          })),
      };
    });

    // Order by workflow DAG (depth), keep parallels together, lock terminal chain last.
    {
      const predsByKey = new Map<string, string[]>();
      for (const e of edges) {
        const list = predsByKey.get(e.toNodeKey) ?? [];
        list.push(e.fromNodeKey);
        predsByKey.set(e.toNodeKey, list);
      }
      const depthByKey = new Map<string, number>();
      const depthOf = (key: string, stack: Set<string>): number => {
        const cached = depthByKey.get(key);
        if (cached != null) return cached;
        if (stack.has(key)) return 0;
        stack.add(key);
        const preds = predsByKey.get(key) ?? [];
        const d = preds.length
          ? 1 + Math.max(...preds.map((p) => depthOf(p, stack)))
          : 0;
        stack.delete(key);
        depthByKey.set(key, d);
        return d;
      };
      for (const s of stages) depthOf(s.nodeKey, new Set());

      const terminalRank = (code: string | undefined) => {
        const c = String(code ?? '').toUpperCase();
        if (c === 'INSPECTION') return 1;
        if (c === 'PACKAGING') return 2;
        if (c === 'DELIVERY') return 3;
        return 0;
      };
      const topoIndex = new Map(
        (compiled?.topologicalOrder ?? []).map((k, i) => [k, i] as const),
      );

      stages.sort((a, b) => {
        const aTerm = terminalRank(a.stageCode) > 0 ? 1 : 0;
        const bTerm = terminalRank(b.stageCode) > 0 ? 1 : 0;
        // Inspection → Packaging → Delivery always after production middle stages.
        if (aTerm !== bTerm) return aTerm - bTerm;
        const da = depthByKey.get(a.nodeKey) ?? 0;
        const db = depthByKey.get(b.nodeKey) ?? 0;
        if (da !== db) return da - db;
        const ra = terminalRank(a.stageCode);
        const rb = terminalRank(b.stageCode);
        if (ra !== rb) return ra - rb;
        const ta = topoIndex.get(a.nodeKey) ?? 9999;
        const tb = topoIndex.get(b.nodeKey) ?? 9999;
        if (ta !== tb) return ta - tb;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });

      // Recompute display steps after terminal reordering (depth alone is not enough).
      const predsForStep = predsByKey;
      const stepDepth = new Map<string, number>();
      const stepDepthOf = (key: string, stack: Set<string>): number => {
        const cached = stepDepth.get(key);
        if (cached != null) return cached;
        if (stack.has(key)) return 0;
        stack.add(key);
        // Prefer longest path among non-terminal-forced order: use list index among sorted preds
        const preds = predsForStep.get(key) ?? [];
        const d = preds.length
          ? 1 + Math.max(...preds.map((p) => stepDepthOf(p, stack)))
          : 0;
        stack.delete(key);
        stepDepth.set(key, d);
        return d;
      };

      let step = 0;
      let lastBand = '';
      for (const s of stages) {
        const d = stepDepthOf(s.nodeKey, new Set());
        const tr = terminalRank(s.stageCode);
        const band = tr > 0 ? `T:${tr}` : `M:${d}`;
        if (band !== lastBand) {
          step += 1;
          lastBand = band;
        }
        (s as { flowLevel?: number; flowStep?: number }).flowLevel = d;
        (s as { flowLevel?: number; flowStep?: number }).flowStep = step;
      }
    }

    const excluded = (compiled?.excluded ?? []).map((node) => ({
      workflowNodeId: node.sourceWorkflowNodeId,
      nodeKey: node.nodeKey,
      stageDefinitionId: node.stageDefinitionId,
      stageCode: node.stageCode,
      nameEn: node.nameEn,
      nameAr: node.nameAr,
      isExcluded: true,
      isRequired: node.isRequired,
      behavior: 'NONE' as StageInventoryBehavior,
    }));

    const setupStages: SetupStageInput[] = [
      ...stages.map((s) => ({
        workflowNodeId: s.workflowNodeId,
        nodeKey: s.nodeKey,
        stageDefinitionId: s.stageDefinitionId,
        stageCode: s.stageCode,
        isRequired: s.isRequired,
        isExcluded: false,
        requiresInspection: s.requiresInspection,
        behavior: s.behavior,
        consumesRawMaterials: s.consumesRawMaterials,
        consumesSemiFinished: s.consumesSemiFinished,
        outputNameEn: s.output?.nameEn ?? null,
        outputNameAr: s.output?.nameAr ?? null,
        outputQtyPerUnit: s.output?.qtyPerUnit ?? null,
        expectedPieceCount: s.output?.expectedPieceCount ?? 1,
        pieceLabels: s.output?.pieceLabels ?? null,
        consumeOutputIds: s.consumeOutputIds,
        outputId: s.output?.id ?? null,
        materialInputs: (s.materialInputs ?? []).map((row) => ({
          sku: row.sku,
          qtyPerUnit: row.qtyPerUnit,
        })),
      })),
      ...excluded.map((s) => ({
        workflowNodeId: s.workflowNodeId,
        nodeKey: s.nodeKey,
        stageDefinitionId: s.stageDefinitionId,
        isRequired: s.isRequired,
        isExcluded: true,
        behavior: s.behavior,
      })),
    ];

    const { status, issues } = validateProductionSetup({
      hasPublishedWorkflow: Boolean(versionId && workflow?.activeVersion?.status === 'PUBLISHED'),
      dagIssues: (compiled?.issues ?? []).map((i) => ({
        code: i.code,
        message: i.message,
        nodeKey: i.nodeIds?.[0],
      })),
      bomLines,
      stages: setupStages,
      outputIds: new Set(outputs.map((o) => o.id)),
      knownNodeIds: new Set(setupStages.map((s) => s.workflowNodeId)),
      knownSkus,
      defaultWarehouseByType: {
        RAW_MATERIALS: warehouses.some((w) => w.type === 'RAW_MATERIALS' && w.isDefault),
        SEMI_FINISHED: warehouses.some((w) => w.type === 'SEMI_FINISHED' && w.isDefault),
        FINISHED_GOODS: warehouses.some((w) => w.type === 'FINISHED_GOODS' && w.isDefault),
      },
    });

    return {
      productId,
      product: {
        id: product.id,
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        nameHe: product.nameHe,
        sku: product.sku,
      },
      status,
      issues,
      workflow: workflow
        ? {
            id: workflow.id,
            code: workflow.code,
            nameEn: workflow.nameEn,
            nameAr: workflow.nameAr,
            nameHe: workflow.nameHe,
            published: workflow.activeVersion?.status === 'PUBLISHED',
            versionNumber: workflow.activeVersion?.versionNumber ?? null,
          }
        : null,
      bomLines: bomLines.map((line) => ({
        sku: line.sku,
        qty: line.qty,
        exists: line.exists,
        imageUrl: line.imageUrl ?? null,
        nameEn: line.nameEn ?? null,
        nameAr: line.nameAr ?? null,
        nameHe: line.nameHe ?? null,
        unit: line.unit ?? 'pcs',
      })),
      stages,
      excluded,
      edges: compiled?.edges ?? [],
      warehouses: warehouses.map((w) => ({
        id: w.id,
        code: w.code,
        nameEn: w.nameEn,
        nameAr: w.nameAr,
        nameHe: w.nameHe,
        type: w.type,
        isDefault: w.isDefault,
      })),
      outputs: outputs.map((o) => ({
        id: o.id,
        workflowNodeId: o.workflowNodeId,
        nameEn: o.outputNameEn,
        nameAr: o.outputNameAr,
        nameHe: o.outputNameHe,
        itemClass: o.itemClass,
      })),
    };
  }

  async preview(productId: string) {
    const setup = await this.getSetup(productId);
    const steps = setup.stages.map((stage) => {
      const consumeOutputs = setup.outputs.filter((o) => stage.consumeOutputIds.includes(o.id));
      return {
        stageNameEn: stage.nameEn,
        stageNameAr: stage.nameAr,
        stageNameHe: stage.nameHe ?? null,
        behavior: stage.behavior,
        consumesMaterials: stage.consumesRawMaterials || stage.behavior === 'USES_MATERIALS',
        consumes: consumeOutputs.map((o) => o.nameEn),
        consumeOutputs: consumeOutputs.map((o) => ({
          nameEn: o.nameEn,
          nameAr: o.nameAr,
          nameHe: o.nameHe ?? null,
        })),
        produces: stage.output
          ? {
              nameEn: stage.output.nameEn,
              nameAr: stage.output.nameAr,
              nameHe: stage.output.nameHe ?? null,
              qtyPerUnit: stage.output.qtyPerUnit,
              warehouseAutomatic: !stage.output.defaultWarehouseId,
            }
          : null,
      };
    });
    return { productId, status: setup.status, issues: setup.issues, steps };
  }

  async putSetup(
    productId: string,
    dto: { workflowId?: string | null; stages?: ProductionSetupStagePut[] },
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, archivedAt: null },
    });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });

    if (dto.workflowId) {
      const workflow = await this.prisma.productionWorkflow.findFirst({
        where: { id: dto.workflowId, archivedAt: null },
      });
      if (!workflow?.activeVersionId) {
        throw new BadRequestException({
          code: 'SETUP_WORKFLOW_REQUIRED',
          message: 'Assign a published workflow.',
        });
      }
      await this.prisma.productWorkflowConfiguration.upsert({
        where: { productId },
        create: { productId, workflowId: dto.workflowId },
        update: { workflowId: dto.workflowId },
      });
    }

    const stages = dto.stages ?? [];
    for (const stage of stages) {
      if (!isStageInventoryBehavior(stage.behavior)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Unknown stage inventory behavior.',
        });
      }
    }

    const stageDefIds = [...new Set(stages.map((s) => s.stageDefinitionId))];
    const stageDefs = stageDefIds.length
      ? await this.prisma.productionStageDefinition.findMany({
          where: { id: { in: stageDefIds } },
          select: { id: true, code: true },
        })
      : [];
    const codeByDefId = new Map(stageDefs.map((d) => [d.id, String(d.code ?? '').toUpperCase()]));

    const fgStages = stages.filter((s) => s.behavior === 'PRODUCES_FINISHED');
    if (fgStages.length > 1) {
      throw new BadRequestException({
        code: 'SETUP_FINISHED_MULTIPLE',
        message: 'Only Packaging may produce the finished product.',
      });
    }
    for (const stage of fgStages) {
      if (!isPackagingStageCode(codeByDefId.get(stage.stageDefinitionId))) {
        throw new BadRequestException({
          code: 'SETUP_FINISHED_ONLY_PACKAGING',
          message: 'Only the Packaging stage may produce finished goods.',
        });
      }
    }
    for (const stage of stages) {
      const code = codeByDefId.get(stage.stageDefinitionId);
      if (isInspectionStageCode(code) && behaviorProduces(stage.behavior)) {
        throw new BadRequestException({
          code: 'SETUP_INSPECTION_MUST_NOT_PRODUCE',
          message: 'Inspection confirms quality only and must not create stocked inventory.',
        });
      }
      if (isDeliveryStageCode(code) && behaviorProduces(stage.behavior)) {
        throw new BadRequestException({
          code: 'SETUP_DELIVERY_MUST_NOT_PRODUCE',
          message: 'Delivery checks packages onto the truck and must not create stocked inventory.',
        });
      }
      if (isPackagingStageCode(code)) {
        if (stage.behavior !== 'PRODUCES_FINISHED') {
          throw new BadRequestException({
            code: 'SETUP_PACKAGING_MUST_PRODUCE_FINISHED',
            message: 'Packaging must produce the finished product with ship packages.',
          });
        }
        const packPieces = Number(stage.expectedPieceCount ?? 0);
        if (!(packPieces >= 1) || !Number.isFinite(packPieces)) {
          throw new BadRequestException({
            code: 'SETUP_PACK_PIECES_INVALID',
            message: 'Packaging needs at least one package piece per product unit.',
          });
        }
        const namedPacks = normalizePieceLabels(stage.pieceLabels);
        if (namedPacks.length < Math.max(1, Math.floor(packPieces) || 1)) {
          throw new BadRequestException({
            code: 'SETUP_PACK_LABELS_REQUIRED',
            message: 'Name every ship package for Packaging (for example A, legs, 3).',
          });
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const savedByNode = new Map<string, string>();
      for (const stage of stages) {
        const flags = flagsFromBehaviorWithConsume(stage.behavior, {
          consumesRawMaterials: stage.consumesRawMaterials,
          consumesSemiFinished: stage.consumesSemiFinished,
        });
        const idle =
          flags.inventoryTracking === 'NONE' &&
          !flags.consumesRawMaterials &&
          !flags.consumesSemiFinished;
        const existing = await tx.productStageInventoryOutput.findFirst({
          where: { productId, workflowNodeId: stage.workflowNodeId },
        });
        if (idle) {
          if (existing) {
            await tx.productStageInventoryInput.deleteMany({
              where: { productId, workflowNodeId: stage.workflowNodeId },
            });
            await tx.productStageInventoryOutput.delete({ where: { id: existing.id } });
          }
          continue;
        }

        const produces = behaviorProduces(stage.behavior);
        const itemClass = itemClassForBehavior(stage.behavior);
        const isFinished = stage.behavior === 'PRODUCES_FINISHED';
        const nameEn = isFinished
          ? String(product.nameEn ?? '').trim() || 'Finished product'
          : String(stage.outputNameEn ?? '').trim() ||
            (produces ? 'Component' : 'Stage');
        const nameAr = isFinished
          ? String(product.nameAr ?? '').trim() || nameEn
          : String(stage.outputNameAr ?? '').trim() || nameEn;
        const nameHe = isFinished
          ? product.nameHe ?? null
          : stage.outputNameHe ?? null;
        const pieceLabels: PieceLabel[] = produces
          ? normalizePieceLabels(stage.pieceLabels)
          : [];
        if (produces && !isFinished && pieceLabels.length === 0) {
          pieceLabels.push({ nameEn, nameAr, nameHe });
        }
        const expectedPieceCount = isFinished
          ? Math.max(
              1,
              pieceLabels.length > 0
                ? pieceLabels.length
                : Math.floor(Number(stage.expectedPieceCount) || 1),
            )
          : Math.max(1, pieceLabels.length);
        const qty = Number(stage.outputQtyPerUnit ?? 1);
        const inventoryItemId = produces
          ? (
              await this.ensureOutputItem(tx, {
                productId,
                itemClass:
                  itemClass === 'FINISHED_GOOD'
                    ? InventoryItemClass.FINISHED_GOOD
                    : InventoryItemClass.SEMI_FINISHED_GOOD,
                nameEn,
                nameAr,
                nameHe,
                existingItemId: existing?.inventoryItemId ?? null,
              })
            ).id
          : existing?.inventoryItemId ?? null;

        const data = {
          productId,
          workflowNodeId: stage.workflowNodeId,
          stageDefinitionId: stage.stageDefinitionId,
          itemClass:
            itemClass === 'FINISHED_GOOD'
              ? InventoryItemClass.FINISHED_GOOD
              : itemClass === 'SEMI_FINISHED_GOOD'
                ? InventoryItemClass.SEMI_FINISHED_GOOD
                : InventoryItemClass.RAW_MATERIAL,
          inventoryTracking: flags.inventoryTracking as InventoryTracking,
          consumesRawMaterials: flags.consumesRawMaterials,
          consumesSemiFinished: flags.consumesSemiFinished,
          outputNameAr: nameAr,
          outputNameEn: nameEn,
          outputNameHe: nameHe,
          outputQtyPerUnit: produces && qty > 0 ? qty : 1,
          expectedPieceCount,
          pieceLabels:
            pieceLabels.length > 0
              ? (pieceLabels as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          unit: stage.unit || 'pcs',
          defaultWarehouseId: stage.defaultWarehouseId || null,
          inventoryItemId,
        };

        const saved = existing
          ? await tx.productStageInventoryOutput.update({
              where: { id: existing.id },
              data,
            })
          : await tx.productStageInventoryOutput.create({ data });
        savedByNode.set(stage.workflowNodeId, saved.id);
      }

      const allOutputs = await tx.productStageInventoryOutput.findMany({ where: { productId } });
      const outputById = new Map(allOutputs.map((o) => [o.id, o]));
      const outputByNode = new Map(
        allOutputs
          .filter((o) => o.workflowNodeId)
          .map((o) => [o.workflowNodeId as string, o]),
      );

      const claimOwnerByOutput = new Map<string, string>();
      for (const stage of stages) {
        if (!savedByNode.has(stage.workflowNodeId)) continue;
        await tx.productStageInventoryInput.deleteMany({
          where: { productId, workflowNodeId: stage.workflowNodeId },
        });
        const fromIds = stage.consumeOutputIds ?? [];
        const fromNodes = stage.consumeWorkflowNodeIds ?? [];
        const resolvedIds = [
          ...fromIds.filter((id) => outputById.has(id)),
          ...fromNodes
            .map((nodeId) => outputByNode.get(nodeId)?.id)
            .filter((id): id is string => Boolean(id)),
        ];
        for (const outputId of [...new Set(resolvedIds)]) {
          const owner = claimOwnerByOutput.get(outputId);
          if (owner && owner !== stage.workflowNodeId) {
            throw new BadRequestException({
              code: 'SETUP_CONSUME_OUTPUT_ALREADY_CLAIMED',
              message: 'That semi-finished piece is already taken by another stage.',
            });
          }
          claimOwnerByOutput.set(outputId, stage.workflowNodeId);
          await tx.productStageInventoryInput.create({
            data: {
              productId,
              workflowNodeId: stage.workflowNodeId,
              stageDefinitionId: stage.stageDefinitionId,
              outputId,
              qtyPerUnit: 1,
            },
          });
        }
      }

      if (stages.length) {
        const stale = await tx.productStageInventoryOutput.findMany({
          where: {
            productId,
            workflowNodeId: { notIn: stages.map((s) => s.workflowNodeId) },
          },
        });
        if (stale.length) {
          await tx.productStageInventoryInput.deleteMany({
            where: { outputId: { in: stale.map((s) => s.id) } },
          });
          await tx.productStageInventoryOutput.deleteMany({
            where: { id: { in: stale.map((s) => s.id) } },
          });
        }
      }

      if (dto.stages) {
        await tx.productStageMaterialInput.deleteMany({ where: { productId } });
        const wantedSkus = [
          ...new Set(
            stages.flatMap((stage) =>
              (stage.materialInputs ?? [])
                .map((row) => String(row.sku ?? '').trim())
                .filter(Boolean),
            ),
          ),
        ];
        const wantedIds = [
          ...new Set(
            stages.flatMap((stage) =>
              (stage.materialInputs ?? [])
                .map((row) => String(row.inventoryItemId ?? '').trim())
                .filter(Boolean),
            ),
          ),
        ];
        const items =
          wantedSkus.length || wantedIds.length
            ? await tx.inventoryItem.findMany({
                where: {
                  archivedAt: null,
                  OR: [
                    ...(wantedSkus.length ? [{ sku: { in: wantedSkus } }] : []),
                    ...(wantedIds.length ? [{ id: { in: wantedIds } }] : []),
                  ],
                },
              })
            : [];
        const itemBySku = new Map(items.map((i) => [i.sku, i]));
        const itemById = new Map(items.map((i) => [i.id, i]));
        const seen = new Set<string>();
        const stageIds = new Set(stages.map((s) => s.workflowNodeId));
        const bom = (product.bomDefaults ?? null) as BomDefaults | null;
        const bomQtyBySku = new Map<string, number>();
        for (const line of bom?.materials ?? []) {
          const sku = String(line.sku ?? '').trim();
          if (!sku) continue;
          bomQtyBySku.set(sku, (bomQtyBySku.get(sku) ?? 0) + (Number(line.qty) || 0));
        }
        const mappedQtyBySku = new Map<string, number>();
        for (const stage of stages) {
          if (!stageIds.has(stage.workflowNodeId)) continue;
          for (const row of stage.materialInputs ?? []) {
            const item =
              (row.inventoryItemId ? itemById.get(row.inventoryItemId) : undefined) ??
              (row.sku ? itemBySku.get(String(row.sku).trim()) : undefined);
            if (!item) {
              throw new BadRequestException({
                code: 'SETUP_MATERIAL_SKU_UNKNOWN',
                message: 'Map only real inventory SKUs to stages.',
              });
            }
            if (bomQtyBySku.size > 0 && !bomQtyBySku.has(item.sku)) {
              throw new BadRequestException({
                code: 'SETUP_MATERIAL_SKU_UNKNOWN',
                message: `SKU ${item.sku} is not on this product BOM.`,
              });
            }
            const qty = Number(row.qtyPerUnit);
            if (!(qty > 0)) {
              throw new BadRequestException({
                code: 'SETUP_MATERIAL_QTY_INVALID',
                message: 'Material quantity per unit must be greater than zero.',
              });
            }
            const dupKey = `${stage.workflowNodeId}::${item.id}`;
            if (seen.has(dupKey)) {
              throw new BadRequestException({
                code: 'SETUP_MATERIAL_DUPLICATE',
                message: `SKU ${item.sku} is mapped twice on this stage.`,
              });
            }
            seen.add(dupKey);
            mappedQtyBySku.set(item.sku, (mappedQtyBySku.get(item.sku) ?? 0) + qty);
            await tx.productStageMaterialInput.create({
              data: {
                productId,
                workflowNodeId: stage.workflowNodeId,
                stageDefinitionId: stage.stageDefinitionId,
                inventoryItemId: item.id,
                qtyPerUnit: qty,
                unit: row.unit || item.unit || 'pcs',
                required: row.required !== false,
              },
            });
          }
        }
        for (const [sku, mappedQty] of mappedQtyBySku) {
          const bomQty = bomQtyBySku.get(sku);
          if (bomQty != null && mappedQty > bomQty + 1e-9) {
            throw new BadRequestException({
              code: 'SETUP_MATERIAL_QTY_OVER_BOM',
              message: `SKU ${sku} is assigned ${mappedQty} across stages but BOM only has ${bomQty}.`,
            });
          }
        }
      }
    });

    return this.getSetup(productId);
  }

  private async ensureOutputItem(
    tx: Prisma.TransactionClient,
    args: {
      productId: string;
      itemClass: InventoryItemClass;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
      existingItemId: string | null;
    },
  ) {
    if (args.existingItemId) {
      const existing = await tx.inventoryItem.findUnique({
        where: { id: args.existingItemId },
      });
      if (existing && existing.archivedAt == null) {
        return tx.inventoryItem.update({
          where: { id: existing.id },
          data: {
            nameEn: args.nameEn,
            nameAr: args.nameAr,
            nameHe: args.nameHe ?? undefined,
            itemClass: args.itemClass,
          },
        });
      }
    }
    const found = await tx.inventoryItem.findFirst({
      where: {
        productId: args.productId,
        itemClass: args.itemClass,
        nameEn: args.nameEn,
        archivedAt: null,
      },
    });
    if (found) return found;
    if (args.itemClass === InventoryItemClass.FINISHED_GOOD) {
      const fg = await tx.inventoryItem.findFirst({
        where: { productId: args.productId, itemClass: args.itemClass, archivedAt: null },
      });
      if (fg) {
        return tx.inventoryItem.update({
          where: { id: fg.id },
          data: { nameEn: args.nameEn, nameAr: args.nameAr, nameHe: args.nameHe ?? undefined },
        });
      }
    }
    const prefix = skuPrefixForItemClass(
      args.itemClass === InventoryItemClass.FINISHED_GOOD ? 'FINISHED_GOOD' : 'SEMI_FINISHED_GOOD',
    );
    const rows = await tx.inventoryItem.findMany({
      where: { sku: { startsWith: `${prefix}-` } },
      select: { sku: true },
    });
    const sku = nextSkuFromExisting(
      prefix,
      rows.map((r) => r.sku),
    );
    return tx.inventoryItem.create({
      data: {
        sku,
        nameEn: args.nameEn,
        nameAr: args.nameAr,
        nameHe: args.nameHe ?? undefined,
        itemClass: args.itemClass,
        category: args.itemClass === InventoryItemClass.FINISHED_GOOD ? 'FINISHED' : 'SEMI_FINISHED',
        isPurchasable: false,
        productId: args.productId,
        unit: 'pcs',
      },
    });
  }
}
