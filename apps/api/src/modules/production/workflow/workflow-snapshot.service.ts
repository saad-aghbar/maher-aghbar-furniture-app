import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../../common/prisma.service';
import { SequenceService } from '../../../common/sequence.service';
import { buildStageTaskInstructions } from '../../../common/helpers/stage-task-instructions';
import { WorkflowVersionService } from './workflow-version.service';
import type { CompilerOrderOverride, CompiledProductionWorkflow } from './domain';
import { resolveProductStageOutput } from '../product-inventory-output.resolver';
import { distributeMaterialsToSnapshotNodes } from '../distribute-stage-materials';

type Tx = Prisma.TransactionClient;

@Injectable()
export class WorkflowSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: WorkflowVersionService,
    private readonly sequences: SequenceService,
  ) {}

  private db(tx?: Tx) {
    return tx ?? this.prisma;
  }

  /**
   * Resolve published workflow version for a product that has an explicit configuration.
   * Returns null when the product has no workflow (custom / unconfigured) so admin can assign later.
   */
  async resolveVersionIdForProduct(productId: string | null | undefined, tx?: Tx) {
    const db = this.db(tx);
    if (!productId) return null;
    const config = await db.productWorkflowConfiguration.findUnique({
      where: { productId },
      include: { workflow: true },
    });
    if (config?.workflow.activeVersionId) return config.workflow.activeVersionId;
    return null;
  }

  async resolveVersionIdOrThrow(workflowId: string, tx?: Tx) {
    const db = this.db(tx);
    const workflow = await db.productionWorkflow.findUnique({ where: { id: workflowId } });
    if (!workflow?.activeVersionId) {
      throw new BadRequestException({
        code: 'WORKFLOW_INVALID_STAGE',
        message: 'Workflow has no published active version.',
      });
    }
    return workflow.activeVersionId;
  }

  /**
   * Idempotent: if snapshot exists for PO, return it. Otherwise compile + persist + materialize.
   * Returns null when no product workflow is configured (custom order — needs admin assign).
   */
  async createSnapshotForProductionOrder(
    input: {
      productionOrderId: string;
      productId?: string | null;
      productDescription: string;
      quantity: number;
      specifications?: string | null;
      orderOverrides?: CompilerOrderOverride[];
      createdById?: string;
      /** Force a specific published workflow (admin assign). */
      workflowId?: string;
      /**
       * Piece 2: when provided, replace product stage material inputs on snapshot nodes
       * (expected materials from order production setup). Distributed onto the
       * catalog stage that consumes each SKU — not dumped onto the first raw node.
       */
      materialOverrides?: Array<{
        inventoryItemId: string;
        sku: string;
        qtyPerUnit: number;
        unit?: string;
        required?: boolean;
        quantityMode?: 'LINEAR' | 'FIXED' | 'SETUP_PLUS_LINEAR' | 'BATCH' | 'PARALLEL_CAPACITY';
      }>;
    },
    tx: Tx,
  ) {
    const existing = await tx.productionOrderWorkflowSnapshot.findUnique({
      where: { productionOrderId: input.productionOrderId },
      include: { nodes: true, edges: true },
    });
    if (existing) return existing;

    const versionId = input.workflowId
      ? await this.resolveVersionIdOrThrow(input.workflowId, tx)
      : await this.resolveVersionIdForProduct(input.productId, tx);

    if (!versionId) return null;

    const version = await tx.productionWorkflowVersion.findUnique({ where: { id: versionId } });
    if (!version || version.status !== 'PUBLISHED') {
      throw new BadRequestException({
        code: 'WORKFLOW_INVALID_STAGE',
        message: 'Active workflow version is not published.',
      });
    }

    const compiled = await this.versions.compileForProduct(
      versionId,
      input.productId,
      input.orderOverrides,
      tx,
    );

    return this.persistCompiledSnapshot(
      {
        productionOrderId: input.productionOrderId,
        sourceWorkflowId: version.workflowId,
        sourceWorkflowVersionId: version.id,
        sourceVersionNumber: version.versionNumber,
        productDescription: input.productDescription,
        quantity: input.quantity,
        specifications: input.specifications,
        createdById: input.createdById,
        materialOverrides: input.materialOverrides,
      },
      compiled,
      tx,
    );
  }

  /**
   * Assign / replace a published workflow on a production order.
   * Preparing (not factory-released, no started tasks): existing snapshot is torn down
   * and rebuilt so plan tasks follow the new workflow.
   */
  async assignWorkflowToProductionOrder(
    productionOrderId: string,
    workflowId: string,
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.productionOrder.findUnique({
        where: { id: productionOrderId },
        include: {
          salesOrderLine: {
            include: {
              productionSetup: {
                include: {
                  materialRequirements: { orderBy: { sortOrder: 'asc' as const } },
                },
              },
            },
          },
        },
      });
      if (!po) {
        throw new BadRequestException({
          code: 'NOT_FOUND',
          message: 'Production order not found.',
        });
      }

      const status = String(po.status ?? '').toUpperCase();
      const factoryStarted =
        Boolean(po.releasedToFactoryAt) ||
        Boolean(po.actualStartDate) ||
        [
          'IN_PROGRESS',
          'ON_HOLD',
          'QUALITY_CHECK',
          'READY_FOR_PACKAGING',
          'READY_FOR_DELIVERY',
          'COMPLETED',
        ].includes(status);
      if (factoryStarted) {
        throw new BadRequestException({
          code: 'ORDER_WORKFLOW_LOCKED',
          message: 'Cannot change workflow after Confirm / factory work has started.',
        });
      }

      const startedTasks = await tx.productionTask.count({
        where: {
          productionOrderId,
          status: {
            in: [
              'IN_PROGRESS',
              'PAUSED',
              'BLOCKED',
              'READY_FOR_INSPECTION',
              'COMPLETED',
            ],
          },
        },
      });
      if (startedTasks > 0) {
        throw new BadRequestException({
          code: 'ORDER_WORKFLOW_LOCKED',
          message: 'Cannot change workflow after a task has started.',
        });
      }

      const existing = await tx.productionOrderWorkflowSnapshot.findUnique({
        where: { productionOrderId },
      });

      if (existing) {
        await tx.scheduleAllocation.deleteMany({
          where: { productionTask: { productionOrderId } },
        });
        await tx.productionTaskMaterialUsage.deleteMany({ where: { productionOrderId } });
        await tx.taskTimeEntry.deleteMany({
          where: { task: { productionOrderId } },
        });
        await tx.taskBlocker.deleteMany({
          where: { task: { productionOrderId } },
        });
        await tx.productionTask.deleteMany({ where: { productionOrderId } });
        await tx.productionStageInstance.deleteMany({ where: { productionOrderId } });
        await tx.productionOrderWorkflowSnapshot.delete({
          where: { productionOrderId },
        });
        await tx.productionOrder.update({
          where: { id: productionOrderId },
          data: {
            currentStageCode: null,
            progressPercent: 0,
            status: status === 'DRAFT' ? 'DRAFT' : 'PLANNED',
          },
        });
      }

      if (po.salesOrderLineId) {
        await tx.salesOrderLineSetup.updateMany({
          where: { salesOrderLineId: po.salesOrderLineId },
          data: {
            workflowId,
            workflowConfirmedAt: new Date(),
          },
        });
      }

      const mats = po.salesOrderLine?.productionSetup?.materialRequirements ?? [];
      const materialOverrides = mats
        .filter((m) => m.inventoryItemId && m.sku)
        .map((m) => ({
          inventoryItemId: m.inventoryItemId!,
          sku: m.sku!,
          qtyPerUnit: Number(m.expectedQty),
          unit: m.unit || 'pcs',
          required: true as const,
        }));

      const snapshot = await this.createSnapshotForProductionOrder(
        {
          productionOrderId,
          productId: po.productId,
          productDescription: po.productDescription,
          quantity: Number(po.quantity),
          specifications: po.specifications,
          createdById: userId,
          workflowId,
          materialOverrides: materialOverrides.length ? materialOverrides : undefined,
        },
        tx,
      );
      if (!snapshot) {
        throw new BadRequestException({
          code: 'WORKFLOW_INVALID_STAGE',
          message: 'Could not create workflow snapshot for this order.',
        });
      }

      await tx.auditEvent.create({
        data: {
          userId: userId ?? null,
          action: existing
            ? 'production-order.workflow.replace'
            : 'production-order.workflow.assign',
          entityType: 'ProductionOrder',
          entityId: productionOrderId,
          newValues: { workflowId, replaced: Boolean(existing) },
        },
      });

      return snapshot;
    });
  }

  async persistCompiledSnapshot(
    meta: {
      productionOrderId: string;
      sourceWorkflowId: string | null;
      sourceWorkflowVersionId: string | null;
      sourceVersionNumber: number | null;
      productDescription: string;
      quantity: number;
      specifications?: string | null;
      createdById?: string;
      isLegacyBackfill?: boolean;
      materialOverrides?: Array<{
        inventoryItemId: string;
        sku: string;
        qtyPerUnit: number;
        unit?: string;
        required?: boolean;
        quantityMode?: 'LINEAR' | 'FIXED' | 'SETUP_PLUS_LINEAR' | 'BATCH' | 'PARALLEL_CAPACITY';
      }>;
    },
    compiled: CompiledProductionWorkflow,
    tx: Tx,
  ) {
    const snapshot = await tx.productionOrderWorkflowSnapshot.create({
      data: {
        productionOrderId: meta.productionOrderId,
        sourceWorkflowId: meta.sourceWorkflowId,
        sourceWorkflowVersionId: meta.sourceWorkflowVersionId,
        sourceVersionNumber: meta.sourceVersionNumber,
        isLegacyBackfill: meta.isLegacyBackfill ?? false,
      },
    });

    const po = await tx.productionOrder.findUnique({
      where: { id: meta.productionOrderId },
      select: {
        productId: true,
        product: { select: { nameEn: true, nameAr: true, nameHe: true } },
      },
    });
    const productOutputs = po?.productId
      ? await tx.productStageInventoryOutput.findMany({ where: { productId: po.productId } })
      : [];
    const productInputs = po?.productId
      ? await tx.productStageInventoryInput.findMany({
          where: { productId: po.productId },
          include: { output: true },
        })
      : [];
    const productMaterialInputs = po?.productId
      ? await tx.productStageMaterialInput.findMany({
          where: { productId: po.productId },
          include: { inventoryItem: { select: { sku: true, unit: true } } },
        })
      : [];
    const overrideRows =
      Array.isArray(meta.materialOverrides) && meta.materialOverrides.length > 0
        ? meta.materialOverrides
        : [];
    const distributedOverrides = overrideRows.length
      ? distributeMaterialsToSnapshotNodes(
          compiled.included.map((n) => ({
            id: n.nodeKey,
            stageCode: n.stageCode,
            sourceWorkflowNodeId: n.sourceWorkflowNodeId,
            stageDefinitionId: n.stageDefinitionId,
            consumesRawMaterials: n.consumesRawMaterials ?? false,
            sortOrder: n.sortOrder,
          })),
          productMaterialInputs.map((row) => ({
            inventoryItemId: row.inventoryItemId,
            workflowNodeId: row.workflowNodeId,
            stageDefinitionId: row.stageDefinitionId,
            qtyPerUnit: row.qtyPerUnit,
            unit: row.unit,
            quantityMode: row.quantityMode,
            sku: row.inventoryItem.sku,
          })),
          overrideRows,
        )
      : [];
    const distributedByNodeKey = new Map<string, typeof distributedOverrides>();
    for (const row of distributedOverrides) {
      const list = distributedByNodeKey.get(row.snapshotNodeId) ?? [];
      list.push(row);
      distributedByNodeKey.set(row.snapshotNodeId, list);
    }

    const nodeIdByKey = new Map<string, string>();

    for (const n of compiled.included) {
      const resolved = resolveProductStageOutput(
        {
          sourceWorkflowNodeId: n.sourceWorkflowNodeId,
          stageDefinitionId: n.stageDefinitionId,
          inventoryTracking: n.inventoryTracking ?? 'NONE',
          consumesRawMaterials: n.consumesRawMaterials ?? false,
          consumesSemiFinished: n.consumesSemiFinished ?? false,
          outputQtyPerUnit: n.outputQtyPerUnit,
          expectedPieceCount: n.expectedPieceCount,
          outputNameAr: n.outputNameAr,
          outputNameEn: n.outputNameEn,
          outputNameHe: n.outputNameHe,
          defaultWarehouseId: n.defaultWarehouseId,
        },
        productOutputs,
      );
      const stageInstance = await tx.productionStageInstance.create({
        data: {
          productionOrderId: meta.productionOrderId,
          stageDefinitionId: n.stageDefinitionId,
          status: 'PENDING',
        },
      });

      const consumeRows = productInputs.filter(
        (row) => row.workflowNodeId === n.sourceWorkflowNodeId,
      );
      const consumeOutputDefinitionIds = consumeRows.map((row) => row.outputId);
      const consumeInventoryItemIds = consumeRows
        .map((row) => row.output.inventoryItemId)
        .filter((id): id is string => Boolean(id));

      const baseMeta =
        n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata)
          ? { ...(n.metadata as Record<string, unknown>) }
          : {};
      if (resolved.pieceLabels.length > 0) {
        baseMeta.pieceLabels = resolved.pieceLabels;
      }
      if (resolved.tracking === 'PRODUCES_FINISHED') {
        baseMeta.packPieceCount = resolved.expectedPieceCount;
      }

      const snapNode = await tx.productionOrderWorkflowSnapshotNode.create({
        data: {
          snapshotId: snapshot.id,
          sourceWorkflowNodeId: n.sourceWorkflowNodeId,
          stageDefinitionId: n.stageDefinitionId,
          stageInstanceId: stageInstance.id,
          nodeKey: n.nodeKey,
          stageCode: n.stageCode,
          nameArSnapshot: n.nameAr,
          nameEnSnapshot: n.nameEn,
          nameHeSnapshot: n.nameHe,
          isRequired: n.isRequired,
          isSkipped: false,
          responsibleDepartmentId: n.responsibleDepartmentId,
          responsibleDepartmentCode: n.responsibleDepartmentCode,
          estimatedMinutes: n.estimatedMinutes,
          estimateReviewRequired: n.estimateReviewRequired,
          requiresInspection: n.requiresInspection,
          requiresPhotos: n.requiresPhotos,
          inventoryTracking: resolved.tracking,
          consumesRawMaterials: resolved.consumesRawMaterials,
          consumesSemiFinished: resolved.consumesSemiFinished,
          schedulingResourceMode: n.schedulingResourceMode,
          resourceSlots: n.resourceSlots,
          executionKind: n.executionKind,
          outputQtyPerUnit: resolved.qtyPerUnit ?? undefined,
          expectedPieceCount: resolved.expectedPieceCount,
          outputNameAr:
            resolved.tracking === 'PRODUCES_FINISHED' && po?.product
              ? po.product.nameAr
              : resolved.nameAr ?? undefined,
          outputNameEn:
            resolved.tracking === 'PRODUCES_FINISHED' && po?.product
              ? po.product.nameEn
              : resolved.nameEn ?? undefined,
          outputNameHe:
            resolved.tracking === 'PRODUCES_FINISHED' && po?.product
              ? po.product.nameHe
              : resolved.nameHe ?? undefined,
          outputUnit: resolved.unit ?? undefined,
          outputDefinitionId: resolved.outputDefinitionId ?? undefined,
          outputInventoryItemId: resolved.inventoryItemId ?? undefined,
          consumeOutputDefinitionIds:
            consumeOutputDefinitionIds.length > 0 ? consumeOutputDefinitionIds : undefined,
          consumeInventoryItemIds:
            consumeInventoryItemIds.length > 0 ? consumeInventoryItemIds : undefined,
          defaultWarehouseId: resolved.warehouseId ?? undefined,
          sortOrder: n.sortOrder,
          displayX: n.displayX,
          displayY: n.displayY,
          metadata:
            Object.keys(baseMeta).length > 0
              ? (baseMeta as Prisma.InputJsonValue)
              : (n.metadata as Prisma.InputJsonValue | undefined),
        },
      });
      nodeIdByKey.set(n.nodeKey, snapNode.id);

      const materialRows = productMaterialInputs.filter(
        (row) => row.workflowNodeId === n.sourceWorkflowNodeId,
      );
      const overrideForNode = distributedByNodeKey.get(n.nodeKey) ?? [];
      if (overrideForNode.length) {
        for (const row of overrideForNode) {
          const sku = row.sku?.trim();
          if (!sku) continue;
          await tx.productionOrderWorkflowSnapshotMaterialInput.create({
            data: {
              snapshotNodeId: snapNode.id,
              stageCode: n.stageCode,
              inventoryItemId: row.inventoryItemId,
              sku,
              qtyPerUnit: row.qtyPerUnit,
              quantityMode: row.quantityMode,
              unit: row.unit || 'pcs',
              required: row.required,
            },
          });
        }
      } else if (!overrideRows.length) {
        for (const row of materialRows) {
          const sku = row.inventoryItem.sku?.trim();
          if (!sku) continue;
          await tx.productionOrderWorkflowSnapshotMaterialInput.create({
            data: {
              snapshotNodeId: snapNode.id,
              stageCode: n.stageCode,
              inventoryItemId: row.inventoryItemId,
              sku,
              qtyPerUnit: row.qtyPerUnit,
              quantityMode: row.quantityMode,
              unit: row.unit || row.inventoryItem.unit || 'pcs',
              required: row.required,
            },
          });
        }
      }

      // LOGISTICS (DELIVERY) is tracked via the Delivery entity — no floor task / capacity.
      if (n.executionKind !== 'LOGISTICS') {
        const taskNumber = await this.sequences.next('TASK', 'TSK');
        await tx.productionTask.create({
          data: {
            number: taskNumber,
            productionOrderId: meta.productionOrderId,
            stageDefinitionId: n.stageDefinitionId,
            stageInstanceId: stageInstance.id,
            name: n.nameEn,
            description: buildStageTaskInstructions({
              stageCode: n.stageCode,
              stageNameEn: n.nameEn,
              productDescription: meta.productDescription,
              quantity: meta.quantity,
              specifications: meta.specifications,
            }),
            status: 'NOT_STARTED',
            estimatedMinutes: n.estimatedMinutes ?? undefined,
            targetQty: meta.quantity,
            completedQty: 0,
          },
        });
      }
    }

    for (const e of compiled.edges) {
      const fromId = nodeIdByKey.get(e.fromNodeKey);
      const toId = nodeIdByKey.get(e.toNodeKey);
      if (!fromId || !toId) continue;
      await tx.productionOrderWorkflowSnapshotEdge.create({
        data: {
          snapshotId: snapshot.id,
          fromSnapshotNodeId: fromId,
          toSnapshotNodeId: toId,
          dependencyType: 'HARD',
        },
      });
    }

    return tx.productionOrderWorkflowSnapshot.findUniqueOrThrow({
      where: { id: snapshot.id },
      include: { nodes: true, edges: true },
    });
  }

  async getSnapshot(productionOrderId: string, tx?: Tx) {
    return this.db(tx).productionOrderWorkflowSnapshot.findUnique({
      where: { productionOrderId },
      include: {
        nodes: { orderBy: { sortOrder: 'asc' } },
        edges: true,
      },
    });
  }

  /** Dependency codes (stageCode) for a stage instance from snapshot edges. */
  async getDependsOnCodesForInstance(
    productionOrderId: string,
    stageInstanceId: string,
    tx?: Tx,
  ): Promise<string[]> {
    const snapshot = await this.getSnapshot(productionOrderId, tx);
    if (!snapshot) return [];
    const node = snapshot.nodes.find((n) => n.stageInstanceId === stageInstanceId);
    if (!node) return [];
    const predIds = snapshot.edges
      .filter((e) => e.toSnapshotNodeId === node.id)
      .map((e) => e.fromSnapshotNodeId);
    return snapshot.nodes
      .filter((n) => predIds.includes(n.id) && !n.isSkipped)
      .map((n) => n.stageCode);
  }
}
