import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../../common/prisma.service';
import { SequenceService } from '../../../common/sequence.service';
import { buildStageTaskInstructions } from '../../../common/helpers/stage-task-instructions';
import { WorkflowVersionService } from './workflow-version.service';
import type { CompilerOrderOverride, CompiledProductionWorkflow } from './domain';
import { resolveProductStageOutput } from '../product-inventory-output.resolver';

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
      },
      compiled,
      tx,
    );
  }

  /**
   * Assign a published workflow to a production order that has no snapshot yet.
   */
  async assignWorkflowToProductionOrder(
    productionOrderId: string,
    workflowId: string,
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.productionOrder.findUnique({ where: { id: productionOrderId } });
      if (!po) {
        throw new BadRequestException({
          code: 'NOT_FOUND',
          message: 'Production order not found.',
        });
      }
      const existing = await tx.productionOrderWorkflowSnapshot.findUnique({
        where: { productionOrderId },
      });
      if (existing) {
        throw new BadRequestException({
          code: 'ORDER_WORKFLOW_LOCKED',
          message: 'Production order already has a workflow snapshot.',
        });
      }
      const started = await tx.productionStageInstance.count({
        where: {
          productionOrderId,
          status: { in: ['IN_PROGRESS', 'COMPLETED'] },
        },
      });
      if (started > 0) {
        throw new BadRequestException({
          code: 'ORDER_WORKFLOW_LOCKED',
          message: 'Cannot assign workflow after production has started.',
        });
      }

      const snapshot = await this.createSnapshotForProductionOrder(
        {
          productionOrderId,
          productId: po.productId,
          productDescription: po.productDescription,
          quantity: Number(po.quantity),
          specifications: po.specifications,
          createdById: userId,
          workflowId,
        },
        tx,
      );
      if (!snapshot) {
        throw new BadRequestException({
          code: 'WORKFLOW_INVALID_STAGE',
          message: 'Could not create workflow snapshot for this order.',
        });
      }
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
      select: { productId: true },
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
          outputQtyPerUnit: resolved.qtyPerUnit ?? undefined,
          outputNameAr: resolved.nameAr ?? undefined,
          outputNameEn: resolved.nameEn ?? undefined,
          outputNameHe: resolved.nameHe ?? undefined,
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
          metadata: n.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      nodeIdByKey.set(n.nodeKey, snapNode.id);

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
        },
      });
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
