import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryCategory, Prisma, SalesOrderMaterialRequirementSource } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { canonicalInventoryImageUrl } from '../inventory/inventory-image';
import {
  behaviorFromFlags,
  flagsFromBehaviorWithConsume,
  isStageInventoryBehavior,
  type StageInventoryBehavior,
} from '../../common/helpers/inventory-stage-behavior.util';
import {
  normalizePieceLabels,
  pieceLabelsFromMetadata,
} from './piece-labels';
import { taskHasPlannedTiming } from './production-readiness';
import {
  buildMaterialCostMap,
  costBreakdownFromMaterialRows,
  productionPriceFromBreakdown,
} from '../../common/helpers/order-costing.util';

export type OrderPlanBomLineInput = {
  inventoryItemId?: string | null;
  sku?: string | null;
  displayName?: string | null;
  category?: string | null;
  unit?: string;
  expectedQty: number;
  source?: 'CATALOG' | 'FACTORY_MODIFIED' | 'CUSTOM';
  needsReview?: boolean;
};

export type OrderPlanStagePut = {
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
  pieceLabels?: Array<{ nameEn: string; nameAr?: string | null; nameHe?: string | null }>;
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
export class OrderPlanSetupService {
  constructor(private readonly prisma: PrismaService) {}

  private assertStaff(user?: AuthUser) {
    if (user?.customerId) {
      throw new BadRequestException({
        code: 'FORBIDDEN',
        message: 'Dealers cannot edit the production plan.',
      });
    }
  }

  private async requireEditablePo(productionOrderId: string) {
    const po = await this.prisma.productionOrder.findFirst({
      where: { id: productionOrderId, archivedAt: null },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            nameEn: true,
            nameAr: true,
            nameHe: true,
            imageUrl: true,
          },
        },
        // plannedStartDate is a scalar on ProductionOrder (always selected).
        salesOrder: {
          select: {
            id: true,
            number: true,
            requiredDeliveryDate: true,
            committedDeliveryDate: true,
            customer: {
              select: {
                id: true,
                name: true,
                nameEn: true,
                nameAr: true,
                nameHe: true,
              },
            },
          },
        },
        salesOrderLine: {
          include: {
            productionSetup: {
              include: {
                materialRequirements: { orderBy: { sortOrder: 'asc' as const } },
                workflow: {
                  select: {
                    id: true,
                    code: true,
                    nameEn: true,
                    nameAr: true,
                    nameHe: true,
                  },
                },
              },
            },
          },
        },
        workflowSnapshot: {
          include: {
            sourceWorkflow: {
              select: {
                id: true,
                code: true,
                nameEn: true,
                nameAr: true,
                nameHe: true,
              },
            },
            nodes: {
              orderBy: { sortOrder: 'asc' },
              include: {
                materialInputs: true,
                stageDefinition: {
                  select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true },
                },
              },
            },
            edges: true,
          },
        },
        tasks: {
          where: { status: { not: 'CANCELLED' } },
          select: {
            id: true,
            number: true,
            name: true,
            status: true,
            assignedEmployeeId: true,
            plannedStart: true,
            plannedCompletion: true,
            notes: true,
            stageDefinitionId: true,
            stageDefinition: {
              select: {
                id: true,
                code: true,
                nameEn: true,
                nameAr: true,
                nameHe: true,
                executionKind: true,
                responsibleDepartment: true,
              },
            },
            assignedEmployee: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { number: 'asc' },
        },
      },
    });
    if (!po) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Production order not found.',
      });
    }
    return po;
  }

  private isPlanEditable(po: {
    releasedToFactoryAt: Date | null;
    actualStartDate: Date | null;
    status: string;
  }) {
    if (po.releasedToFactoryAt || po.actualStartDate) return false;
    const status = String(po.status ?? '').toUpperCase();
    return ![
      'IN_PROGRESS',
      'ON_HOLD',
      'QUALITY_CHECK',
      'READY_FOR_PACKAGING',
      'READY_FOR_DELIVERY',
      'COMPLETED',
    ].includes(status);
  }

  async getPlanSetup(productionOrderId: string, user?: AuthUser) {
    this.assertStaff(user);
    const po = await this.requireEditablePo(productionOrderId);
    const planEditable = this.isPlanEditable(po);
    const lineSetup = po.salesOrderLine?.productionSetup ?? null;
    const snapshot = po.workflowSnapshot;

    const warehouses = await this.prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        nameHe: true,
        type: true,
        isDefault: true,
      },
    });

    const itemIds = [
      ...new Set(
        (lineSetup?.materialRequirements ?? [])
          .map((m) => m.inventoryItemId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const snapshotItemIds = (snapshot?.nodes ?? []).flatMap((n) =>
      n.materialInputs.map((m) => m.inventoryItemId),
    );
    const allItemIds = [...new Set([...itemIds, ...snapshotItemIds])];
    const items = allItemIds.length
      ? await this.prisma.inventoryItem.findMany({
          where: { id: { in: allItemIds } },
          select: {
            id: true,
            sku: true,
            unit: true,
            imageUrl: true,
            nameEn: true,
            nameAr: true,
            nameHe: true,
            category: true,
            standardCost: true,
          },
        })
      : [];
    const itemById = new Map(items.map((i) => [i.id, i]));

    const bomLines = (lineSetup?.materialRequirements ?? []).map((m) => {
      const item = m.inventoryItemId ? itemById.get(m.inventoryItemId) : undefined;
      const unitCost = item?.standardCost != null ? Number(item.standardCost) : 0;
      return {
        inventoryItemId: m.inventoryItemId,
        sku: m.sku ?? item?.sku ?? '',
        qty: Number(m.expectedQty) || 0,
        exists: Boolean(m.inventoryItemId),
        imageUrl: item ? canonicalInventoryImageUrl(item) : null,
        nameEn: m.displayName ?? item?.nameEn ?? null,
        nameAr: item?.nameAr ?? null,
        nameHe: item?.nameHe ?? null,
        unit: m.unit || item?.unit || 'pcs',
        category: m.category ?? item?.category ?? null,
        source: m.source,
        needsReview: m.needsReview,
        unitCost: Number.isFinite(unitCost) ? unitCost : 0,
      };
    });

    const nodes = snapshot?.nodes ?? [];
    const nodeBySourceId = new Map(
      nodes
        .filter((n) => n.sourceWorkflowNodeId)
        .map((n) => [n.sourceWorkflowNodeId as string, n]),
    );
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const predsByNodeId = new Map<string, string[]>();
    for (const e of snapshot?.edges ?? []) {
      const list = predsByNodeId.get(e.toSnapshotNodeId) ?? [];
      list.push(e.fromSnapshotNodeId);
      predsByNodeId.set(e.toSnapshotNodeId, list);
    }

    const ancestorSourceIds = (nodeId: string): Set<string> => {
      const out = new Set<string>();
      const stack = [nodeId];
      const visited = new Set<string>();
      while (stack.length) {
        const cur = stack.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const fromId of predsByNodeId.get(cur) ?? []) {
          const from = nodeById.get(fromId);
          if (from?.sourceWorkflowNodeId) out.add(from.sourceWorkflowNodeId);
          stack.push(fromId);
        }
      }
      return out;
    };

    const stages = nodes.map((node, index) => {
      const workflowNodeId = node.sourceWorkflowNodeId ?? node.id;
      const behavior = behaviorFromFlags({
        inventoryTracking: node.inventoryTracking as never,
        consumesRawMaterials: node.consumesRawMaterials,
        consumesSemiFinished: node.consumesSemiFinished,
      });
      const meta =
        node.metadata && typeof node.metadata === 'object' && !Array.isArray(node.metadata)
          ? (node.metadata as Record<string, unknown>)
          : {};
      const consumeWorkflowNodeIds = Array.isArray(meta.consumeWorkflowNodeIds)
        ? meta.consumeWorkflowNodeIds.map(String)
        : [];
      const pieceLabels = pieceLabelsFromMetadata(node.metadata);
      const preds = ancestorSourceIds(node.id);
      const upstreamOutputs = nodes
        .filter(
          (n) =>
            n.sourceWorkflowNodeId &&
            preds.has(n.sourceWorkflowNodeId) &&
            n.inventoryTracking === 'PRODUCES_SEMI_FINISHED',
        )
        .map((n) => ({
          id: n.outputInventoryItemId || `node:${n.sourceWorkflowNodeId}`,
          workflowNodeId: n.sourceWorkflowNodeId,
          nameEn: n.outputNameEn || n.nameEnSnapshot,
          nameAr: n.outputNameAr || n.nameArSnapshot,
          nameHe: n.outputNameHe ?? n.nameHeSnapshot,
        }));

      return {
        workflowNodeId,
        snapshotNodeId: node.id,
        nodeKey: node.nodeKey,
        stageDefinitionId: node.stageDefinitionId ?? node.stageDefinition?.id ?? '',
        stageCode: node.stageCode,
        nameEn: node.nameEnSnapshot || node.stageDefinition?.nameEn || node.stageCode,
        nameAr: node.nameArSnapshot || node.stageDefinition?.nameAr || node.stageCode,
        nameHe: node.nameHeSnapshot ?? node.stageDefinition?.nameHe ?? null,
        behavior,
        consumesRawMaterials: node.consumesRawMaterials,
        consumesSemiFinished: node.consumesSemiFinished,
        consumeOutputIds: Array.isArray(node.consumeOutputDefinitionIds)
          ? (node.consumeOutputDefinitionIds as string[])
          : [],
        consumeWorkflowNodeIds,
        materialInputs: node.materialInputs.map((row) => {
          const item = itemById.get(row.inventoryItemId);
          return {
            inventoryItemId: row.inventoryItemId,
            sku: row.sku || item?.sku || '',
            qtyPerUnit: Number(row.qtyPerUnit),
            unit: row.unit || item?.unit || 'pcs',
            required: row.required,
            imageUrl: item ? canonicalInventoryImageUrl(item) : null,
            nameEn: item?.nameEn ?? null,
            nameAr: item?.nameAr ?? null,
            nameHe: item?.nameHe ?? null,
          };
        }),
        output:
          node.inventoryTracking !== 'NONE'
            ? {
                id: node.outputInventoryItemId ?? node.id,
                nameEn: node.outputNameEn,
                nameAr: node.outputNameAr,
                nameHe: node.outputNameHe,
                qtyPerUnit: node.outputQtyPerUnit != null ? Number(node.outputQtyPerUnit) : 1,
                expectedPieceCount: node.expectedPieceCount ?? 1,
                pieceLabels,
                unit: node.outputUnit ?? 'pcs',
                defaultWarehouseId: node.defaultWarehouseId,
                inventoryItemId: node.outputInventoryItemId,
              }
            : null,
        upstreamOutputs,
        flowStep: index + 1,
        flowLevel: index,
        sortOrder: node.sortOrder,
      };
    });

    const workflow =
      snapshot?.sourceWorkflow ??
      lineSetup?.workflow ??
      null;

    const executableTasks = (po.tasks ?? []).filter((t) => {
      const kind = String(t.stageDefinition?.executionKind ?? '').toUpperCase();
      if (kind === 'LOGISTICS') return false;
      const code = String(t.stageDefinition?.code ?? '').toUpperCase();
      return code !== 'DELIVERY';
    });

    return {
      productionOrderId: po.id,
      salesOrderId: po.salesOrderId,
      salesOrderLineId: po.salesOrderLineId,
      planEditable,
      factoryReleased: Boolean(po.releasedToFactoryAt),
      plannedStartDate: po.plannedStartDate?.toISOString() ?? null,
      requiredDeliveryDate:
        po.requiredDeliveryDate?.toISOString() ??
        po.salesOrder?.requiredDeliveryDate?.toISOString() ??
        null,
      committedDeliveryDate:
        po.committedDeliveryDate?.toISOString() ??
        po.salesOrder?.committedDeliveryDate?.toISOString() ??
        null,
      product: po.product
        ? {
            id: po.product.id,
            sku: po.product.sku,
            nameEn: po.product.nameEn,
            nameAr: po.product.nameAr,
            nameHe: po.product.nameHe,
            imageUrl: po.product.imageUrl,
          }
        : null,
      salesOrder: po.salesOrder
        ? {
            id: po.salesOrder.id,
            number: po.salesOrder.number,
            customer: po.salesOrder.customer,
          }
        : null,
      workflow: workflow
        ? {
            id: workflow.id,
            code: 'code' in workflow ? workflow.code : undefined,
            nameEn: workflow.nameEn,
            nameAr: workflow.nameAr,
            nameHe: workflow.nameHe,
          }
        : null,
      bomLines,
      stages,
      warehouses,
      tasks: executableTasks.map((t) => ({
        id: t.id,
        number: t.number,
        name: t.name,
        status: t.status,
        assignedEmployeeId: t.assignedEmployeeId,
        plannedStart: t.plannedStart,
        plannedCompletion: t.plannedCompletion,
        notes: t.notes ?? null,
        stageDefinitionId: t.stageDefinitionId,
        stageDefinition: t.stageDefinition,
        assigneeName: t.assignedEmployee
          ? `${t.assignedEmployee.firstName} ${t.assignedEmployee.lastName}`.trim()
          : null,
      })),
      readiness: (() => {
        const missingAssignment = executableTasks
          .filter((t) => !t.assignedEmployeeId)
          .map((t) => t.id);
        const missingDates = executableTasks
          .filter((t) => !taskHasPlannedTiming(t))
          .map((t) => t.id);
        const hasProductionStart = Boolean(po.plannedStartDate);
        return {
          hasWorkflow: Boolean(workflow?.id),
          hasMaterials: bomLines.length > 0,
          hasExecutableTasks: executableTasks.length > 0,
          hasProductionStart,
          assignment: {
            required: executableTasks.length,
            assigned: executableTasks.filter((t) => t.assignedEmployeeId).length,
            missing: missingAssignment,
          },
          dates: {
            required: executableTasks.length,
            ready: executableTasks.length - missingDates.length,
            missing: missingDates,
          },
          canConfirm:
            planEditable &&
            Boolean(workflow?.id) &&
            bomLines.length > 0 &&
            executableTasks.length > 0 &&
            hasProductionStart &&
            missingAssignment.length === 0 &&
            missingDates.length === 0,
        };
      })(),
    };
  }

  async putPlanSetup(
    productionOrderId: string,
    dto: {
      bomLines?: OrderPlanBomLineInput[];
      stages?: OrderPlanStagePut[];
      workflowId?: string | null;
    },
    user?: AuthUser,
  ) {
    this.assertStaff(user);
    const po = await this.requireEditablePo(productionOrderId);
    if (!this.isPlanEditable(po)) {
      throw new BadRequestException({
        code: 'SETUP_LOCKED',
        message: 'Production plan can no longer be edited after Confirm.',
      });
    }

    const lineSetup = po.salesOrderLine?.productionSetup;
    if (!lineSetup || !po.salesOrderLineId) {
      throw new BadRequestException({
        code: 'SETUP_REQUIRED',
        message: 'Order line production setup is missing.',
      });
    }

    const snapshot = po.workflowSnapshot;
    if (!snapshot?.nodes.length) {
      throw new BadRequestException({
        code: 'WORKFLOW_REQUIRED',
        message: 'Assign a workflow before saving the production plan.',
      });
    }

    if (dto.workflowId && dto.workflowId !== snapshot.sourceWorkflowId) {
      throw new BadRequestException({
        code: 'WORKFLOW_MISMATCH',
        message: 'Change workflow via assign before saving stage plan.',
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

    const bomLines = dto.bomLines;
    if (bomLines) {
      // Stages often still claim workflow defaults (e.g. MAT-BEECH × 4) while the
      // admin is editing the order BOM (adding fabric). Auto-expand the BOM to
      // cover stage claims so Save never blocks on “4 > 0”.
      const claimed = new Map<
        string,
        { qty: number; inventoryItemId?: string | null; unit?: string }
      >();
      for (const stage of stages) {
        for (const row of stage.materialInputs ?? []) {
          const sku = String(row.sku ?? '').trim();
          if (!sku) continue;
          const prev = claimed.get(sku);
          claimed.set(sku, {
            qty: (prev?.qty ?? 0) + Number(row.qtyPerUnit || 0),
            inventoryItemId: row.inventoryItemId ?? prev?.inventoryItemId ?? null,
            unit: row.unit ?? prev?.unit,
          });
        }
      }

      const mergedBom: OrderPlanBomLineInput[] = bomLines.map((b) => ({ ...b }));
      const indexBySku = new Map<string, number>();
      for (let i = 0; i < mergedBom.length; i++) {
        const sku = String(mergedBom[i]?.sku ?? '').trim().toUpperCase();
        if (sku) indexBySku.set(sku, i);
      }
      for (const [sku, claim] of claimed) {
        const key = sku.toUpperCase();
        const idx = indexBySku.get(key);
        if (idx == null) {
          mergedBom.push({
            inventoryItemId: claim.inventoryItemId ?? null,
            sku,
            displayName: sku,
            unit: claim.unit || 'pcs',
            expectedQty: claim.qty,
            source: 'FACTORY_MODIFIED',
            needsReview: !claim.inventoryItemId,
          });
          indexBySku.set(key, mergedBom.length - 1);
        } else {
          const line = mergedBom[idx]!;
          if (Number(line.expectedQty) + 1e-6 < claim.qty) {
            line.expectedQty = claim.qty;
          }
        }
      }

      const resolved = await this.resolveBomRows(mergedBom);
      const poolBySku = new Map<string, number>();
      for (const row of resolved) {
        const sku = String(row.sku ?? '').trim();
        if (!sku) continue;
        poolBySku.set(sku, (poolBySku.get(sku) ?? 0) + Number(row.expectedQty || 0));
      }
      for (const [sku, claim] of claimed) {
        const pool = poolBySku.get(sku) ?? 0;
        if (claim.qty > pool + 1e-6) {
          throw new BadRequestException({
            code: 'BOM_CLAIM_EXCEEDED',
            message: `Stage materials for ${sku} exceed the order BOM (${claim.qty} > ${pool}).`,
          });
        }
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.salesOrderLineMaterialRequirement.deleteMany({
            where: { lineSetupId: lineSetup.id },
          });
          if (resolved.length) {
            await tx.salesOrderLineMaterialRequirement.createMany({
              data: resolved.map((m, idx) => ({
                lineSetupId: lineSetup.id,
                inventoryItemId: m.inventoryItemId,
                sku: m.sku,
                displayName: m.displayName,
                category: m.category as InventoryCategory | null,
                unit: m.unit,
                expectedQty: m.expectedQty,
                source: m.source,
                needsReview: m.needsReview,
                notes: null,
                requestedFabricLabel: null,
                sortOrder: idx,
              })),
            });
          }
          await tx.salesOrderLineSetup.update({
            where: { id: lineSetup.id },
            data: {
              materialsReviewedAt: resolved.some((m) => m.needsReview) ? null : new Date(),
              workflowConfirmedAt: lineSetup.workflowId
                ? new Date()
                : lineSetup.workflowConfirmedAt,
            },
          });
        });
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code?: string }).code)
            : '';
        if (code === 'P2003' || code === 'P2002') {
          throw new BadRequestException({
            code: 'BOM_INVALID',
            message:
              'One or more materials could not be saved. Pick items from inventory and try again.',
          });
        }
        throw err;
      }

      if (po.salesOrderId) {
        const lineQty = Number(po.salesOrderLine?.quantity) || 1;
        await this.syncSalesOrderCostFromBom(po.salesOrderId, resolved, lineQty);
      }
    }

    if (stages.length) {
      const nodeBySource = new Map(
        snapshot.nodes
          .filter((n) => n.sourceWorkflowNodeId)
          .map((n) => [n.sourceWorkflowNodeId as string, n]),
      );
      const nodeById = new Map(snapshot.nodes.map((n) => [n.id, n]));

      await this.prisma.$transaction(async (tx) => {
        for (const stage of stages) {
          const node =
            nodeBySource.get(stage.workflowNodeId) ?? nodeById.get(stage.workflowNodeId);
          if (!node) continue;

          const flags = flagsFromBehaviorWithConsume(stage.behavior, {
            consumesRawMaterials: stage.consumesRawMaterials,
            consumesSemiFinished: stage.consumesSemiFinished,
          });
          const pieceLabels = normalizePieceLabels(stage.pieceLabels);
          const prevMeta =
            node.metadata && typeof node.metadata === 'object' && !Array.isArray(node.metadata)
              ? { ...(node.metadata as Record<string, unknown>) }
              : {};
          const consumeNodeIds = (stage.consumeWorkflowNodeIds ?? []).map(String);
          const consumeItemIds: string[] = [];
          for (const nid of consumeNodeIds) {
            const producer = nodeBySource.get(nid) ?? nodeById.get(nid);
            if (producer?.outputInventoryItemId) {
              consumeItemIds.push(producer.outputInventoryItemId);
            }
          }

          await tx.productionOrderWorkflowSnapshotNode.update({
            where: { id: node.id },
            data: {
              inventoryTracking: flags.inventoryTracking,
              consumesRawMaterials: flags.consumesRawMaterials,
              consumesSemiFinished: flags.consumesSemiFinished,
              outputNameEn: stage.outputNameEn ?? null,
              outputNameAr: stage.outputNameAr ?? null,
              outputNameHe: stage.outputNameHe ?? null,
              outputQtyPerUnit:
                stage.outputQtyPerUnit != null
                  ? new Prisma.Decimal(stage.outputQtyPerUnit)
                  : null,
              expectedPieceCount: Math.max(
                1,
                Math.floor(Number(stage.expectedPieceCount) || pieceLabels.length || 1),
              ),
              defaultWarehouseId: stage.defaultWarehouseId ?? null,
              consumeInventoryItemIds: consumeItemIds.length
                ? (consumeItemIds as Prisma.InputJsonValue)
                : Prisma.JsonNull,
              consumeOutputDefinitionIds: (stage.consumeOutputIds ?? []).length
                ? (stage.consumeOutputIds as Prisma.InputJsonValue)
                : Prisma.JsonNull,
              metadata: {
                ...prevMeta,
                pieceLabels,
                consumeWorkflowNodeIds: consumeNodeIds,
              } as Prisma.InputJsonValue,
            },
          });

          await tx.productionOrderWorkflowSnapshotMaterialInput.deleteMany({
            where: { snapshotNodeId: node.id },
          });

          const mats = stage.materialInputs ?? [];
          if (mats.length && flags.consumesRawMaterials) {
            const rows: Array<{
              snapshotNodeId: string;
              stageCode: string;
              inventoryItemId: string;
              sku: string;
              qtyPerUnit: number;
              unit: string;
              required: boolean;
            }> = [];
            for (const row of mats) {
              const resolvedItem = await this.resolveInventoryRef(
                tx,
                row.inventoryItemId ?? null,
                String(row.sku ?? '').trim() || null,
              );
              if (!resolvedItem) continue;
              rows.push({
                snapshotNodeId: node.id,
                stageCode: node.stageCode,
                inventoryItemId: resolvedItem.id,
                sku: resolvedItem.sku,
                qtyPerUnit: Number(row.qtyPerUnit) || 0,
                unit: row.unit || resolvedItem.unit || 'pcs',
                required: row.required !== false,
              });
            }
            if (rows.length) {
              await tx.productionOrderWorkflowSnapshotMaterialInput.createMany({
                data: rows.map((r) => ({
                  ...r,
                  quantityMode: 'LINEAR' as const,
                })),
              });
            }
          }
        }

        await tx.productionOrderWorkflowSnapshot.update({
          where: { id: snapshot.id },
          data: {
            customizedAt: new Date(),
            customizedById: user?.id ?? null,
          },
        });
      });
    }

    await this.prisma.auditEvent.create({
      data: {
        userId: user?.id ?? null,
        action: 'production-order.plan-setup.put',
        entityType: 'ProductionOrder',
        entityId: productionOrderId,
        newValues: {
          bomCount: dto.bomLines?.length ?? null,
          stageCount: stages.length,
        },
      },
    });

    return this.getPlanSetup(productionOrderId, user);
  }

  private async resolveBomRows(materials: OrderPlanBomLineInput[]) {
    const out: Array<{
      inventoryItemId: string | null;
      sku: string | null;
      displayName: string | null;
      category: InventoryCategory | null;
      unit: string;
      expectedQty: number;
      source: SalesOrderMaterialRequirementSource;
      needsReview: boolean;
      unitCost: number;
    }> = [];

    for (const m of materials) {
      const item = await this.resolveInventoryRef(
        this.prisma,
        m.inventoryItemId ?? null,
        m.sku?.trim() || null,
      );
      const sku = item?.sku ?? (m.sku?.trim() || null);
      const unit = m.unit || item?.unit || 'pcs';
      const displayName = m.displayName || item?.nameEn || null;
      const category = asInventoryCategory(m.category || item?.category || null);
      const unitCost =
        item?.standardCost != null && Number.isFinite(Number(item.standardCost))
          ? Number(item.standardCost)
          : 0;

      out.push({
        inventoryItemId: item?.id ?? null,
        sku,
        displayName,
        category,
        unit,
        expectedQty: Math.max(0, Number(m.expectedQty) || 0),
        source: (m.source as SalesOrderMaterialRequirementSource) || 'FACTORY_MODIFIED',
        needsReview: Boolean(m.needsReview) || !item,
        unitCost,
      });
    }
    return out;
  }

  private async resolveInventoryRef(
    db: Prisma.TransactionClient | PrismaService,
    inventoryItemId: string | null,
    sku: string | null,
  ): Promise<{
    id: string;
    sku: string;
    unit: string;
    nameEn: string;
    category: string | null;
    standardCost: Prisma.Decimal | number | null;
  } | null> {
    if (inventoryItemId) {
      const byId = await db.inventoryItem.findFirst({
        where: { id: inventoryItemId, archivedAt: null },
        select: {
          id: true,
          sku: true,
          unit: true,
          nameEn: true,
          category: true,
          standardCost: true,
        },
      });
      if (byId) return byId;
    }
    if (sku) {
      return db.inventoryItem.findFirst({
        where: { sku, archivedAt: null },
        select: {
          id: true,
          sku: true,
          unit: true,
          nameEn: true,
          category: true,
          standardCost: true,
        },
      });
    }
    return null;
  }

  private async syncSalesOrderCostFromBom(
    salesOrderId: string,
    resolved: Array<{
      sku: string | null;
      category: InventoryCategory | null;
      expectedQty: number;
      unitCost: number;
    }>,
    lineQty: number,
  ) {
    const skus = resolved.map((r) => r.sku).filter((s): s is string => Boolean(s));
    const items = skus.length
      ? await this.prisma.inventoryItem.findMany({
          where: { sku: { in: skus }, archivedAt: null },
          select: { sku: true, standardCost: true },
        })
      : [];
    const map = buildMaterialCostMap({ standardCosts: items });
    const breakdown = costBreakdownFromMaterialRows(
      resolved.map((row) => ({
        sku: row.sku,
        category: row.category,
        qty: (Number(row.expectedQty) || 0) * lineQty,
        unitCost: row.unitCost,
      })),
      map,
    );
    const productionPrice = productionPriceFromBreakdown(breakdown);
    await this.prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        manufacturingCost: productionPrice,
        costBreakdown: breakdown,
      },
    });
  }
}

const INVENTORY_CATEGORIES = new Set<string>(Object.values(InventoryCategory));

function asInventoryCategory(raw: string | null): InventoryCategory | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (INVENTORY_CATEGORIES.has(upper)) return upper as InventoryCategory;
  if (upper.includes('FABRIC') || upper === 'FAB') return InventoryCategory.FABRIC;
  if (upper.includes('WOOD') || upper.includes('TIMBER')) return InventoryCategory.WOOD;
  if (upper.includes('FOAM')) return InventoryCategory.FOAM;
  if (upper.includes('PAINT')) return InventoryCategory.PAINT;
  if (upper.includes('ACCESS')) return InventoryCategory.DECORATIVE_ACCESSORY;
  if (upper.includes('PACK')) return InventoryCategory.PACKAGING;
  return InventoryCategory.OTHER;
}
