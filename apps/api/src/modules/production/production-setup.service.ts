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
  unit?: string | null;
  defaultWarehouseId?: string | null;
  consumeOutputIds?: string[];
  consumeWorkflowNodeIds?: string[];
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

    const [config, outputs, inputs, warehouses, materials, inventoryItems] = await Promise.all([
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
      this.prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.material.findMany({
        where: { archivedAt: null },
        select: { sku: true },
      }),
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null },
        select: { sku: true },
      }),
    ]);

    const knownSkus = new Set([
      ...materials.map((m) => m.sku),
      ...inventoryItems.map((i) => i.sku),
    ]);
    const bom = (product.bomDefaults ?? null) as BomDefaults | null;
    const bomLines = (bom?.materials ?? []).map((line) => ({
      sku: line.sku ?? '',
      qty: Number(line.qty) || 0,
      exists: Boolean(line.sku && knownSkus.has(line.sku)),
    }));

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

    const stages = (compiled?.included ?? []).map((node) => {
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
              nameEn: productRow.outputNameEn,
              nameAr: productRow.outputNameAr,
              nameHe: productRow.outputNameHe,
              qtyPerUnit: Number(productRow.outputQtyPerUnit),
              unit: productRow.unit,
              defaultWarehouseId: productRow.defaultWarehouseId,
              inventoryItemId: productRow.inventoryItemId,
              itemClass: productRow.itemClass,
            }
          : resolved.produces
            ? {
                id: resolved.outputDefinitionId,
                nameEn: resolved.nameEn,
                nameAr: resolved.nameAr,
                nameHe: resolved.nameHe,
                qtyPerUnit: resolved.qtyPerUnit,
                unit: resolved.unit,
                defaultWarehouseId: resolved.warehouseId,
                inventoryItemId: resolved.inventoryItemId,
                itemClass: resolved.itemClass,
              }
            : null,
        consumeOutputIds,
        upstreamOutputs: outputs
          .filter((o) => o.workflowNodeId && o.workflowNodeId !== node.sourceWorkflowNodeId)
          .filter(
            (o) =>
              o.inventoryTracking === InventoryTracking.PRODUCES_SEMI_FINISHED ||
              o.itemClass === InventoryItemClass.SEMI_FINISHED_GOOD,
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
        consumeOutputIds: s.consumeOutputIds,
        outputId: s.output?.id ?? null,
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
      defaultWarehouseByType: {
        RAW_MATERIALS: warehouses.some((w) => w.type === 'RAW_MATERIALS' && w.isDefault),
        SEMI_FINISHED: warehouses.some((w) => w.type === 'SEMI_FINISHED' && w.isDefault),
        FINISHED_GOODS: warehouses.some((w) => w.type === 'FINISHED_GOODS' && w.isDefault),
      },
    });

    return {
      productId,
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
      bomLines: (bom?.materials ?? []).map((line, i) => ({
        sku: line.sku ?? '',
        qty: Number(line.qty) || 0,
        exists: bomLines[i]?.exists ?? false,
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
        const nameEn =
          String(stage.outputNameEn ?? '').trim() ||
          (produces ? 'Component' : 'Stage');
        const nameAr = String(stage.outputNameAr ?? '').trim() || nameEn;
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
                nameHe: stage.outputNameHe,
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
          outputNameHe: stage.outputNameHe ?? null,
          outputQtyPerUnit: produces && qty > 0 ? qty : 1,
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
