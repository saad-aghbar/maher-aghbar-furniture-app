import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../../common/prisma.service';
import { isLockedAnchorStageCode } from '@maher/types';
import {
  compileWorkflow,
  validateWorkflowGraph,
  validateTerminalChain,
  validateOpeningChain,
  planTerminalChainAppend,
  planOpeningChainAppend,
  TERMINAL_STAGE_CODES,
  OPENING_STAGE_CODE,
  type CompilerNode,
  type CompilerOrderOverride,
  type CompilerProductOverride,
} from './domain';
import {
  cartesianReconnect,
  nextNodeSortOrder,
  resolveGeneratedCode,
  resolveNodeKey,
} from './domain/technical-id';

type Tx = Prisma.TransactionClient;

@Injectable()
export class WorkflowVersionService {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Tx) {
    return tx ?? this.prisma;
  }

  private isTerminalStageCode(code: string): boolean {
    return (TERMINAL_STAGE_CODES as readonly string[]).includes(code);
  }

  private isOpeningStageCode(code: string): boolean {
    return code === OPENING_STAGE_CODE;
  }

  /** Packaging + Delivery stay fully locked; Inspection allows production predecessor updates. */
  private isFullyLockedTerminalCode(code: string): boolean {
    return code === 'PACKAGING' || code === 'DELIVERY';
  }

  private terminalLockedError(action: string): BadRequestException {
    return new BadRequestException({
      code: 'TERMINAL_CHAIN_LOCKED',
      message: `Inspection, Packaging, and Delivery are locked finishing stages and cannot be ${action}.`,
    });
  }

  private openingLockedError(action: string): BadRequestException {
    return new BadRequestException({
      code: 'OPENING_CHAIN_LOCKED',
      message: `Material preparation is a locked starting stage and cannot be ${action}.`,
    });
  }

  async listWorkflows() {
    return this.prisma.productionWorkflow.findMany({
      where: { archivedAt: null },
      include: {
        activeVersion: {
          include: {
            _count: { select: { nodes: true, edges: true } },
          },
        },
        _count: { select: { versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getWorkflow(id: string) {
    const row = await this.prisma.productionWorkflow.findUnique({
      where: { id },
      include: {
        activeVersion: {
          include: {
            nodes: { include: { stageDefinition: true }, orderBy: { sortOrder: 'asc' } },
            edges: true,
          },
        },
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Workflow not found.' });
    return row;
  }

  async createWorkflow(input: {
    code?: string;
    nameAr: string;
    nameEn: string;
    nameHe?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    descriptionHe?: string;
    createdById?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productionWorkflow.findMany({ select: { code: true } });
      const code = resolveGeneratedCode(
        input.code,
        input.nameEn,
        existing.map((row) => row.code),
      );
      const workflow = await tx.productionWorkflow.create({
        data: {
          code,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          nameHe: input.nameHe,
          descriptionAr: input.descriptionAr,
          descriptionEn: input.descriptionEn,
          descriptionHe: input.descriptionHe,
          status: 'DRAFT',
          createdById: input.createdById,
        },
      });
      const version = await tx.productionWorkflowVersion.create({
        data: {
          workflowId: workflow.id,
          versionNumber: 1,
          status: 'DRAFT',
          name: `${input.nameEn} v1`,
          createdById: input.createdById,
        },
      });
      await this.audit(tx, input.createdById, 'workflow.created', 'ProductionWorkflow', workflow.id, {
        code: workflow.code,
        versionId: version.id,
      });
      return { ...workflow, versions: [version] };
    });
  }

  /** Soft-delete: archive workflow and detach product assignments. */
  async archiveWorkflow(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.productionWorkflow.findUnique({ where: { id } });
      if (!workflow || workflow.archivedAt) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Workflow not found.' });
      }

      await tx.productWorkflowConfiguration.deleteMany({ where: { workflowId: id } });
      await tx.productionWorkflow.update({
        where: { id },
        data: {
          activeVersionId: null,
          status: 'ARCHIVED',
          archivedAt: new Date(),
        },
      });
      await this.audit(tx, userId, 'workflow.archived', 'ProductionWorkflow', id, {
        code: workflow.code,
      });
      return { archived: true, id };
    });
  }

  async createDraftVersion(workflowId: string, userId?: string, fromVersionId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.productionWorkflow.findUnique({ where: { id: workflowId } });
      if (!workflow) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Workflow not found.' });

      const sourceId = fromVersionId ?? workflow.activeVersionId;
      const source = sourceId
        ? await tx.productionWorkflowVersion.findUnique({
            where: { id: sourceId },
            include: { nodes: true, edges: true },
          })
        : null;

      const max = await tx.productionWorkflowVersion.aggregate({
        where: { workflowId },
        _max: { versionNumber: true },
      });
      const versionNumber = (max._max.versionNumber ?? 0) + 1;

      const draft = await tx.productionWorkflowVersion.create({
        data: {
          workflowId,
          versionNumber,
          status: 'DRAFT',
          name: `${workflow.nameEn} v${versionNumber}`,
          createdById: userId,
          changelog: source ? `Cloned from v${source.versionNumber}` : 'New draft',
        },
      });

      const nodeIdMap = new Map<string, string>();
      if (source) {
        for (const n of source.nodes) {
          const created = await tx.productionWorkflowNode.create({
            data: {
              workflowVersionId: draft.id,
              stageDefinitionId: n.stageDefinitionId,
              nodeKey: n.nodeKey,
              sortOrder: n.sortOrder,
              displayX: n.displayX,
              displayY: n.displayY,
              isRequiredByDefault: n.isRequiredByDefault,
              canBeSkipped: n.canBeSkipped,
              defaultEstimatedMinutes: n.defaultEstimatedMinutes,
              responsibleDepartmentId: n.responsibleDepartmentId,
              requiresInspectionOverride: n.requiresInspectionOverride,
              requiresPhotosOverride: n.requiresPhotosOverride,
              inventoryTracking: n.inventoryTracking,
              consumesRawMaterials: n.consumesRawMaterials,
              consumesSemiFinished: n.consumesSemiFinished,
              outputQtyPerUnit: n.outputQtyPerUnit,
              outputNameAr: n.outputNameAr,
              outputNameEn: n.outputNameEn,
              outputNameHe: n.outputNameHe,
              defaultWarehouseId: n.defaultWarehouseId,
              metadata: n.metadata ?? undefined,
            },
          });
          nodeIdMap.set(n.id, created.id);
        }
        for (const e of source.edges) {
          const fromNodeId = nodeIdMap.get(e.fromNodeId);
          const toNodeId = nodeIdMap.get(e.toNodeId);
          if (!fromNodeId || !toNodeId) continue;
          await tx.productionWorkflowEdge.create({
            data: {
              workflowVersionId: draft.id,
              fromNodeId,
              toNodeId,
              dependencyType: e.dependencyType,
            },
          });
        }
      }

      await this.audit(tx, userId, 'workflow.draft.created', 'ProductionWorkflowVersion', draft.id, {
        workflowId,
        versionNumber,
      });
      return draft;
    });
  }

  async assertDraftMutable(versionId: string, tx?: Tx) {
    const version = await this.db(tx).productionWorkflowVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version not found.' });
    if (version.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'WORKFLOW_VERSION_IMMUTABLE',
        message: 'Published workflow versions cannot be edited. Create a new draft.',
      });
    }
    return version;
  }

  async bumpRevision(versionId: string, expectedRevision: number | undefined, tx?: Tx) {
    const db = this.db(tx);
    if (expectedRevision != null) {
      const updated = await db.productionWorkflowVersion.updateMany({
        where: { id: versionId, revision: expectedRevision, status: 'DRAFT' },
        data: { revision: { increment: 1 } },
      });
      if (!updated.count) {
        throw new ConflictException({
          code: 'WORKFLOW_VERSION_STALE',
          message: 'Workflow draft was updated elsewhere. Reload and try again.',
        });
      }
      return;
    }
    await db.productionWorkflowVersion.update({
      where: { id: versionId },
      data: { revision: { increment: 1 } },
    });
  }

  async addNode(
    versionId: string,
    data: {
      stageDefinitionId: string;
      nodeKey?: string;
      sortOrder?: number;
      displayX?: number;
      displayY?: number;
      isRequiredByDefault?: boolean;
      canBeSkipped?: boolean;
      defaultEstimatedMinutes?: number;
      responsibleDepartmentId?: string;
      requiresInspectionOverride?: boolean;
      requiresPhotosOverride?: boolean;
      inventoryTracking?: 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED';
      consumesRawMaterials?: boolean;
      consumesSemiFinished?: boolean;
      outputQtyPerUnit?: number;
      expectedPieceCount?: number;
      outputNameAr?: string;
      outputNameEn?: string;
      outputNameHe?: string;
      defaultWarehouseId?: string;
      runsAfterNodeIds?: string[];
      expectedRevision?: number;
    },
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDraftMutable(versionId, tx);
      await this.bumpRevision(versionId, data.expectedRevision, tx);
      const stage = await tx.productionStageDefinition.findUnique({
        where: { id: data.stageDefinitionId },
      });
      if (!stage) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Stage not found.' });
      }
      if (this.isTerminalStageCode(stage.code)) {
        throw this.terminalLockedError('added manually');
      }
      const existingNodes = await tx.productionWorkflowNode.findMany({
        where: { workflowVersionId: versionId },
        select: { nodeKey: true, sortOrder: true },
      });
      const nodeKey = resolveNodeKey(
        data.nodeKey,
        stage.code,
        existingNodes.map((n) => n.nodeKey),
      );
      const maxSort = existingNodes.reduce((m, n) => Math.max(m, n.sortOrder), -1);
      // Photo-required middle stages default to producing semi-finished kits.
      const tracking =
        data.inventoryTracking ??
        (stage.requiresPhotos && data.requiresPhotosOverride !== false
          ? 'PRODUCES_SEMI_FINISHED'
          : data.requiresPhotosOverride === true
            ? 'PRODUCES_SEMI_FINISHED'
            : undefined);
      const node = await tx.productionWorkflowNode.create({
        data: {
          workflowVersionId: versionId,
          stageDefinitionId: data.stageDefinitionId,
          nodeKey,
          sortOrder: data.sortOrder ?? nextNodeSortOrder(maxSort),
          displayX: data.displayX,
          displayY: data.displayY,
          isRequiredByDefault: data.isRequiredByDefault ?? true,
          canBeSkipped: data.canBeSkipped ?? false,
          defaultEstimatedMinutes: data.defaultEstimatedMinutes,
          responsibleDepartmentId: data.responsibleDepartmentId,
          requiresInspectionOverride: data.requiresInspectionOverride,
          requiresPhotosOverride: data.requiresPhotosOverride,
          inventoryTracking: tracking,
          consumesRawMaterials: data.consumesRawMaterials ?? false,
          consumesSemiFinished: data.consumesSemiFinished ?? false,
          outputQtyPerUnit: data.outputQtyPerUnit,
          expectedPieceCount: data.expectedPieceCount,
          outputNameAr: data.outputNameAr,
          outputNameEn: data.outputNameEn,
          outputNameHe: data.outputNameHe,
          defaultWarehouseId: data.defaultWarehouseId,
        },
      });
      for (const fromNodeId of data.runsAfterNodeIds ?? []) {
        await tx.productionWorkflowEdge.create({
          data: {
            workflowVersionId: versionId,
            fromNodeId,
            toNodeId: node.id,
            dependencyType: 'HARD',
          },
        });
      }
      await this.audit(tx, userId, 'workflow.node.added', 'ProductionWorkflowNode', node.id, data);
      return node;
    });
  }

  async updateNode(
    versionId: string,
    nodeId: string,
    data: Prisma.ProductionWorkflowNodeUpdateInput & {
      runsAfterNodeIds?: string[];
      expectedRevision?: number;
    },
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDraftMutable(versionId, tx);
      await this.bumpRevision(versionId, data.expectedRevision, tx);
      const { runsAfterNodeIds, expectedRevision: _r, ...rest } = data;
      const existing = await tx.productionWorkflowNode.findFirst({
        where: { id: nodeId, workflowVersionId: versionId },
        include: { stageDefinition: true },
      });
      if (!existing) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Node not found.' });
      }
      if (this.isOpeningStageCode(existing.stageDefinition.code)) {
        if (runsAfterNodeIds !== undefined) {
          throw this.openingLockedError('rewired');
        }
        if (rest.canBeSkipped === true || rest.isRequiredByDefault === false) {
          throw this.openingLockedError('marked optional');
        }
      }
      if (this.isFullyLockedTerminalCode(existing.stageDefinition.code)) {
        if (runsAfterNodeIds !== undefined) {
          throw this.terminalLockedError('rewired');
        }
        if (rest.canBeSkipped === true || rest.isRequiredByDefault === false) {
          throw this.terminalLockedError('marked optional');
        }
      }
      let effectiveRunsAfter = runsAfterNodeIds;
      if (existing.stageDefinition.code === 'INSPECTION') {
        if (rest.canBeSkipped === true || rest.isRequiredByDefault === false) {
          throw this.terminalLockedError('marked optional');
        }
        if (effectiveRunsAfter !== undefined) {
          // Strip Packaging/Delivery/Inspection from Inspection preds instead of throwing —
          // corrupt reconnect leftovers must not block production authoring.
          const fromNodes = await tx.productionWorkflowNode.findMany({
            where: { id: { in: effectiveRunsAfter }, workflowVersionId: versionId },
            include: { stageDefinition: true },
          });
          const allowed = new Set(
            fromNodes
              .filter(
                (from) =>
                  !this.isFullyLockedTerminalCode(from.stageDefinition.code) &&
                  from.stageDefinition.code !== 'INSPECTION',
              )
              .map((from) => from.id),
          );
          effectiveRunsAfter = effectiveRunsAfter.filter((id) => allowed.has(id));
        }
      }
      const node = await tx.productionWorkflowNode.update({
        where: { id: nodeId },
        data: rest,
      });
      if (effectiveRunsAfter !== undefined) {
        await tx.productionWorkflowEdge.deleteMany({
          where: { workflowVersionId: versionId, toNodeId: nodeId },
        });
        for (const fromNodeId of effectiveRunsAfter) {
          await tx.productionWorkflowEdge.create({
            data: {
              workflowVersionId: versionId,
              fromNodeId,
              toNodeId: nodeId,
              dependencyType: 'HARD',
            },
          });
        }
      }
      await this.audit(tx, userId, 'workflow.node.updated', 'ProductionWorkflowNode', nodeId, data);
      return node;
    });
  }

  private async reconnectAndDeleteNode(
    tx: Tx,
    versionId: string,
    nodeId: string,
    reconnect: boolean,
  ) {
    const incoming = await tx.productionWorkflowEdge.findMany({
      where: { workflowVersionId: versionId, toNodeId: nodeId },
    });
    const outgoing = await tx.productionWorkflowEdge.findMany({
      where: { workflowVersionId: versionId, fromNodeId: nodeId },
    });
    if (reconnect) {
      const pairs = cartesianReconnect(
        incoming.map((e) => e.fromNodeId),
        outgoing.map((e) => e.toNodeId),
      );
      for (const pair of pairs) {
        await tx.productionWorkflowEdge.upsert({
          where: {
            workflowVersionId_fromNodeId_toNodeId: {
              workflowVersionId: versionId,
              fromNodeId: pair.fromNodeId,
              toNodeId: pair.toNodeId,
            },
          },
          create: {
            workflowVersionId: versionId,
            fromNodeId: pair.fromNodeId,
            toNodeId: pair.toNodeId,
            dependencyType: 'HARD',
          },
          update: {},
        });
      }
    }
    await tx.productionWorkflowEdge.deleteMany({
      where: {
        workflowVersionId: versionId,
        OR: [{ fromNodeId: nodeId }, { toNodeId: nodeId }],
      },
    });
    await tx.productionWorkflowNode.delete({ where: { id: nodeId } });
  }

  async removeNode(
    versionId: string,
    nodeId: string,
    options: { reconnect?: boolean; expectedRevision?: number },
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDraftMutable(versionId, tx);
      await this.bumpRevision(versionId, options.expectedRevision, tx);
      const target = await tx.productionWorkflowNode.findFirst({
        where: { id: nodeId, workflowVersionId: versionId },
        include: { stageDefinition: true },
      });
      if (!target) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Node not found.' });
      }
      if (this.isOpeningStageCode(target.stageDefinition.code)) {
        throw this.openingLockedError('removed');
      }
      if (this.isTerminalStageCode(target.stageDefinition.code)) {
        throw this.terminalLockedError('removed');
      }
      await this.reconnectAndDeleteNode(tx, versionId, nodeId, options.reconnect !== false);
      await this.audit(tx, userId, 'workflow.node.removed', 'ProductionWorkflowNode', nodeId, options);
      return { ok: true };
    });
  }

  /**
   * Remove a stage definition from the library going forward.
   * Strips it from every workflow version (draft and published) and product
   * templates. Production orders that already ran the stage keep instances,
   * tasks, and snapshots. Locked anchors cannot be deleted.
   */
  async deleteStageDefinition(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stage = await tx.productionStageDefinition.findUnique({ where: { id } });
      if (!stage) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Stage not found.' });
      }
      if (isLockedAnchorStageCode(stage.code)) {
        throw new BadRequestException({
          code: 'LOCKED_ANCHOR_STAGE',
          message: 'Material Prep, Inspection, Packaging, and Delivery cannot be deleted.',
        });
      }

      const nodes = await tx.productionWorkflowNode.findMany({
        where: { stageDefinitionId: id },
        select: { id: true, workflowVersionId: true },
      });
      const versionIds = [...new Set(nodes.map((n) => n.workflowVersionId))];
      for (const node of nodes) {
        await this.reconnectAndDeleteNode(tx, node.workflowVersionId, node.id, true);
      }
      for (const versionId of versionIds) {
        await tx.productionWorkflowVersion.update({
          where: { id: versionId },
          data: { revision: { increment: 1 } },
        });
      }

      await tx.productWorkflowStageOverride.deleteMany({ where: { stageDefinitionId: id } });
      await tx.productStageEstimate.deleteMany({ where: { stageDefinitionId: id } });
      await tx.productStageMaterialInput.deleteMany({ where: { stageDefinitionId: id } });
      await tx.productStageInventoryOutput.deleteMany({ where: { stageDefinitionId: id } });
      await tx.workerSkill.deleteMany({ where: { stageDefinitionId: id } });
      await tx.stageEstimateStat.deleteMany({ where: { stageDefinitionId: id } });

      const remaining =
        (await tx.productionStageInstance.count({ where: { stageDefinitionId: id } })) +
        (await tx.productionTask.count({ where: { stageDefinitionId: id } })) +
        (await tx.productionOrderWorkflowSnapshotNode.count({ where: { stageDefinitionId: id } }));

      if (remaining > 0) {
        const row = await tx.productionStageDefinition.update({
          where: { id },
          data: { isActive: false },
        });
        await this.audit(tx, userId, 'stage.archived', 'ProductionStageDefinition', id, {
          hardDeleted: false,
        });
        return row;
      }

      await tx.productionStageDefinition.delete({ where: { id } });
      await this.audit(tx, userId, 'stage.deleted', 'ProductionStageDefinition', id, {
        hardDeleted: true,
        code: stage.code,
      });
      return { id, deleted: true };
    });
  }

  async validateVersion(versionId: string) {
    const version = await this.prisma.productionWorkflowVersion.findUnique({
      where: { id: versionId },
      include: { nodes: { include: { stageDefinition: true } }, edges: true },
    });
    if (!version) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version not found.' });
    const graph = validateWorkflowGraph(
      version.nodes.map((n) => ({ id: n.id, nodeKey: n.nodeKey })),
      version.edges.map((e) => ({ fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
    );
    const chain = validateTerminalChain(
      version.nodes.map((n) => ({
        id: n.id,
        nodeKey: n.nodeKey,
        stageCode: n.stageDefinition.code,
        isRequired: n.isRequiredByDefault && !n.canBeSkipped,
        isSkipped: false,
      })),
      version.edges.map((e) => ({ fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
    );
    const opening = validateOpeningChain(
      version.nodes.map((n) => ({
        id: n.id,
        nodeKey: n.nodeKey,
        stageCode: n.stageDefinition.code,
        isRequired: n.isRequiredByDefault && !n.canBeSkipped,
        isSkipped: false,
      })),
      version.edges.map((e) => ({ fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
    );
    const issues = [...graph.issues, ...chain, ...opening];
    return { ok: issues.length === 0, issues };
  }

  /**
   * Authoring UX: append missing INSPECTION → PACKAGING → DELIVERY nodes/edges to a draft.
   * Never called from compile/publish — callers invoke explicitly before validate/publish.
   */
  async applyTerminalChainAppend(
    versionId: string,
    userId?: string,
    expectedRevision?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDraftMutable(versionId, tx);

      const version = await tx.productionWorkflowVersion.findUnique({
        where: { id: versionId },
        include: { nodes: { include: { stageDefinition: true } }, edges: true },
      });
      if (!version) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version not found.' });
      }

      const nodeById = new Map(version.nodes.map((n) => [n.id, n]));
      const plan = planTerminalChainAppend(
        version.nodes.map((n) => ({ stageCode: n.stageDefinition.code })),
        version.edges.map((e) => ({
          fromStageCode: nodeById.get(e.fromNodeId)!.stageDefinition.code,
          toStageCode: nodeById.get(e.toNodeId)!.stageDefinition.code,
        })),
      );

      if (plan.addStageCodes.length === 0 && plan.addEdges.length === 0) {
        return {
          applied: false,
          revision: version.revision,
          addedStages: [] as string[],
          addedEdges: [] as string[],
        };
      }

      await this.bumpRevision(versionId, expectedRevision, tx);

      const refreshedVersion = await tx.productionWorkflowVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: { nodes: { include: { stageDefinition: true } }, edges: true },
      });

      const stageDefs = await tx.productionStageDefinition.findMany({
        where: { code: { in: plan.addStageCodes } },
      });
      const stageByCode = new Map(stageDefs.map((s) => [s.code, s]));
      for (const code of plan.addStageCodes) {
        if (!stageByCode.has(code)) {
          throw new BadRequestException({
            code: 'TERMINAL_CHAIN_STAGE_MISSING',
            message: `Stage library missing ${code}. Add it to the stage library first.`,
          });
        }
      }

      const codeToNodeId = new Map<string, string>();
      for (const n of refreshedVersion.nodes) {
        codeToNodeId.set(n.stageDefinition.code, n.id);
      }

      const outdegree = new Map<string, number>();
      for (const n of refreshedVersion.nodes) outdegree.set(n.id, 0);
      for (const e of refreshedVersion.edges) {
        outdegree.set(e.fromNodeId, (outdegree.get(e.fromNodeId) ?? 0) + 1);
      }
      const oldTerminalIds =
        plan.addStageCodes.includes('INSPECTION')
          ? refreshedVersion.nodes
              .filter((n) => (outdegree.get(n.id) ?? 0) === 0)
              .map((n) => n.id)
          : [];

      const existingNodes = refreshedVersion.nodes.map((n) => ({
        nodeKey: n.nodeKey,
        sortOrder: n.sortOrder,
      }));
      let maxSort = existingNodes.reduce((m, n) => Math.max(m, n.sortOrder), -1);

      for (const code of plan.addStageCodes) {
        const stage = stageByCode.get(code)!;
        const nodeKey = resolveNodeKey(
          undefined,
          stage.code,
          [...existingNodes.map((n) => n.nodeKey), ...plan.addStageCodes],
        );
        maxSort = nextNodeSortOrder(maxSort);
        const node = await tx.productionWorkflowNode.create({
          data: {
            workflowVersionId: versionId,
            stageDefinitionId: stage.id,
            nodeKey,
            sortOrder: maxSort,
            isRequiredByDefault: true,
            canBeSkipped: false,
          },
        });
        codeToNodeId.set(code, node.id);
        existingNodes.push({ nodeKey, sortOrder: maxSort });
      }

      const edgeExists = (fromId: string, toId: string) =>
        refreshedVersion.edges.some((e) => e.fromNodeId === fromId && e.toNodeId === toId);

      if (plan.addStageCodes.includes('INSPECTION')) {
        const inspectionId = codeToNodeId.get('INSPECTION')!;
        for (const fromId of oldTerminalIds) {
          if (fromId !== inspectionId && !edgeExists(fromId, inspectionId)) {
            await tx.productionWorkflowEdge.create({
              data: { workflowVersionId: versionId, fromNodeId: fromId, toNodeId: inspectionId },
            });
          }
        }
      }

      for (const [fromCode, toCode] of plan.addEdges) {
        const fromId = codeToNodeId.get(fromCode);
        const toId = codeToNodeId.get(toCode);
        if (fromId && toId && !edgeExists(fromId, toId)) {
          await tx.productionWorkflowEdge.create({
            data: { workflowVersionId: versionId, fromNodeId: fromId, toNodeId: toId },
          });
        }
      }

      await this.audit(tx, userId, 'workflow.terminal_chain.appended', 'ProductionWorkflowVersion', versionId, {
        addedStages: plan.addStageCodes,
        addedEdges: plan.addEdges,
      });

      const refreshed = await tx.productionWorkflowVersion.findUniqueOrThrow({
        where: { id: versionId },
        select: { revision: true },
      });

      return {
        applied: true,
        revision: refreshed.revision,
        addedStages: plan.addStageCodes,
        addedEdges: plan.addEdges.map(([from, to]) => `${from}->${to}`),
      };
    });
  }

  /**
   * Authoring UX: append missing MATERIAL_PREP as a required root node.
   */
  async applyOpeningChainAppend(
    versionId: string,
    userId?: string,
    expectedRevision?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDraftMutable(versionId, tx);

      const version = await tx.productionWorkflowVersion.findUnique({
        where: { id: versionId },
        include: { nodes: { include: { stageDefinition: true } }, edges: true },
      });
      if (!version) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version not found.' });
      }

      const plan = planOpeningChainAppend(
        version.nodes.map((n) => ({ stageCode: n.stageDefinition.code })),
      );
      if (!plan.addStageCode) {
        return {
          applied: false,
          revision: version.revision,
          addedStages: [] as string[],
        };
      }

      await this.bumpRevision(versionId, expectedRevision, tx);

      const stage = await tx.productionStageDefinition.findUnique({
        where: { code: plan.addStageCode },
      });
      if (!stage) {
        throw new BadRequestException({
          code: 'OPENING_CHAIN_STAGE_MISSING',
          message: `Stage library missing ${plan.addStageCode}. Add it to the stage library first.`,
        });
      }

      const existingNodes = version.nodes.map((n) => ({
        nodeKey: n.nodeKey,
        sortOrder: n.sortOrder,
      }));
      const nodeKey = resolveNodeKey(undefined, stage.code, existingNodes.map((n) => n.nodeKey));
      const minSort = existingNodes.reduce((m, n) => Math.min(m, n.sortOrder), 0);
      const sortOrder = Math.max(0, minSort - 1);

      await tx.productionWorkflowNode.create({
        data: {
          workflowVersionId: versionId,
          stageDefinitionId: stage.id,
          nodeKey,
          sortOrder,
          isRequiredByDefault: true,
          canBeSkipped: false,
        },
      });

      await this.audit(tx, userId, 'workflow.opening_chain.appended', 'ProductionWorkflowVersion', versionId, {
        addedStages: [plan.addStageCode],
      });

      const refreshed = await tx.productionWorkflowVersion.findUniqueOrThrow({
        where: { id: versionId },
        select: { revision: true },
      });

      return {
        applied: true,
        revision: refreshed.revision,
        addedStages: [plan.addStageCode],
      };
    });
  }

  async publish(versionId: string, userId?: string, expectedRevision?: number) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.productionWorkflowVersion.findUnique({
        where: { id: versionId },
        include: { nodes: { include: { stageDefinition: true } }, edges: true },
      });
      if (!version) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version not found.' });
      if (version.status !== 'DRAFT') {
        throw new BadRequestException({
          code: 'WORKFLOW_VERSION_IMMUTABLE',
          message: 'Only draft versions can be published.',
        });
      }
      if (expectedRevision != null && version.revision !== expectedRevision) {
        throw new ConflictException({
          code: 'WORKFLOW_VERSION_STALE',
          message: 'Workflow draft was updated elsewhere. Reload and try again.',
        });
      }

      const graph = validateWorkflowGraph(
        version.nodes.map((n) => ({ id: n.id, nodeKey: n.nodeKey })),
        version.edges.map((e) => ({ fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
      );
      const chain = validateTerminalChain(
        version.nodes.map((n) => ({
          id: n.id,
          nodeKey: n.nodeKey,
          stageCode: n.stageDefinition.code,
          isRequired: n.isRequiredByDefault && !n.canBeSkipped,
          isSkipped: false,
        })),
        version.edges.map((e) => ({ fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
      );
      const opening = validateOpeningChain(
        version.nodes.map((n) => ({
          id: n.id,
          nodeKey: n.nodeKey,
          stageCode: n.stageDefinition.code,
          isRequired: n.isRequiredByDefault && !n.canBeSkipped,
          isSkipped: false,
        })),
        version.edges.map((e) => ({ fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
      );
      const issues = [...graph.issues, ...chain, ...opening];
      if (issues.length > 0) {
        throw new BadRequestException({
          code: issues[0]?.code ?? 'WORKFLOW_INVALID_STAGE',
          message: issues[0]?.message ?? 'Workflow validation failed.',
          issues,
        });
      }

      await tx.productionWorkflowVersion.updateMany({
        where: {
          workflowId: version.workflowId,
          status: 'PUBLISHED',
          id: { not: versionId },
        },
        data: { status: 'SUPERSEDED' },
      });

      const published = await tx.productionWorkflowVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedById: userId,
        },
      });

      await tx.productionWorkflow.update({
        where: { id: version.workflowId },
        data: {
          status: 'ACTIVE',
          activeVersionId: versionId,
        },
      });

      await this.audit(tx, userId, 'workflow.version.published', 'ProductionWorkflowVersion', versionId, {
        versionNumber: version.versionNumber,
      });
      return published;
    });
  }

  /**
   * Discard a DRAFT version. If another published/non-draft version exists, delete the draft.
   * If this is the only version (never published), reset nodes/edges and keep the shell.
   */
  async discardDraft(workflowId: string, versionId: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.productionWorkflowVersion.findUnique({
        where: { id: versionId },
      });
      if (!version || version.workflowId !== workflowId) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version not found.' });
      }
      if (version.status !== 'DRAFT') {
        throw new BadRequestException({
          code: 'WORKFLOW_VERSION_IMMUTABLE',
          message: 'Only draft versions can be discarded.',
        });
      }

      const workflow = await tx.productionWorkflow.findUnique({ where: { id: workflowId } });
      if (!workflow) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Workflow not found.' });
      }

      const nonDraftSibling = await tx.productionWorkflowVersion.findFirst({
        where: {
          workflowId,
          id: { not: versionId },
          status: { not: 'DRAFT' },
        },
      });

      if (nonDraftSibling || (workflow.activeVersionId && workflow.activeVersionId !== versionId)) {
        await tx.productionWorkflowVersion.delete({ where: { id: versionId } });
        await this.audit(tx, userId, 'workflow.draft.discarded', 'ProductionWorkflowVersion', versionId, {
          workflowId,
          mode: 'delete',
        });
        return { discarded: true, mode: 'delete' as const };
      }

      await tx.productionWorkflowEdge.deleteMany({ where: { workflowVersionId: versionId } });
      await tx.productionWorkflowNode.deleteMany({ where: { workflowVersionId: versionId } });
      await tx.productionWorkflowVersion.update({
        where: { id: versionId },
        data: { revision: { increment: 1 }, changelog: 'Draft discarded' },
      });
      await this.audit(tx, userId, 'workflow.draft.discarded', 'ProductionWorkflowVersion', versionId, {
        workflowId,
        mode: 'reset',
      });
      return { discarded: true, mode: 'reset' as const };
    });
  }

  async loadCompilerInput(versionId: string, tx?: Tx) {
    const db = this.db(tx);
    const version = await db.productionWorkflowVersion.findUnique({
      where: { id: versionId },
      include: {
        nodes: { include: { stageDefinition: true } },
        edges: true,
      },
    });
    if (!version) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version not found.' });

    const nodes: CompilerNode[] = version.nodes.map((n) => ({
      id: n.id,
      nodeKey: n.nodeKey,
      stageDefinitionId: n.stageDefinitionId,
      sortOrder: n.sortOrder,
      displayX: n.displayX,
      displayY: n.displayY,
      isRequiredByDefault: n.isRequiredByDefault,
      canBeSkipped: n.canBeSkipped,
      defaultEstimatedMinutes: n.defaultEstimatedMinutes,
      responsibleDepartmentId: n.responsibleDepartmentId,
      requiresInspectionOverride: n.requiresInspectionOverride,
      requiresPhotosOverride: n.requiresPhotosOverride,
      inventoryTracking: n.inventoryTracking,
      consumesRawMaterials: n.consumesRawMaterials,
      consumesSemiFinished: n.consumesSemiFinished,
      schedulingResourceMode: n.schedulingResourceMode,
      resourceSlots: n.resourceSlots,
      outputQtyPerUnit: n.outputQtyPerUnit != null ? Number(n.outputQtyPerUnit) : null,
      expectedPieceCount: n.expectedPieceCount ?? null,
      outputNameAr: n.outputNameAr,
      outputNameEn: n.outputNameEn,
      outputNameHe: n.outputNameHe,
      defaultWarehouseId: n.defaultWarehouseId,
      metadata: n.metadata,
      stage: {
        id: n.stageDefinition.id,
        code: n.stageDefinition.code,
        nameAr: n.stageDefinition.nameAr,
        nameEn: n.stageDefinition.nameEn,
        nameHe: n.stageDefinition.nameHe,
        estimatedHours: n.stageDefinition.estimatedHours
          ? Number(n.stageDefinition.estimatedHours)
          : null,
        requiresInspection: n.stageDefinition.requiresInspection,
        requiresPhotos: n.stageDefinition.requiresPhotos,
        responsibleDepartment: n.stageDefinition.responsibleDepartment,
        schedulingResourceMode: n.stageDefinition.schedulingResourceMode,
        resourceSlots: n.stageDefinition.resourceSlots,
        executionKind: n.stageDefinition.executionKind,
      },
    }));

    return {
      version,
      nodes,
      edges: version.edges.map((e) => ({
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
        dependencyType: 'HARD' as const,
      })),
    };
  }

  async compileForProductReport(
    versionId: string,
    productId: string | null | undefined,
    orderOverrides?: CompilerOrderOverride[],
    tx?: Tx,
  ) {
    const { nodes, edges } = await this.loadCompilerInput(versionId, tx);
    let productOverrides: CompilerProductOverride[] = [];
    const productEstimateMinutes: Record<string, number | null> = {};

    if (productId) {
      const config = await this.db(tx).productWorkflowConfiguration.findUnique({
        where: { productId },
        include: { stageOverrides: true },
      });
      productOverrides =
        config?.stageOverrides.map((o) => ({
          workflowNodeId: o.workflowNodeId,
          stageDefinitionId: o.stageDefinitionId,
          applicability: o.applicability,
          estimatedMinutes: o.estimatedMinutes,
          responsibleDepartmentId: o.responsibleDepartmentId,
        })) ?? [];

      const estimates = await this.db(tx).productStageEstimate.findMany({
        where: { productId },
      });
      for (const e of estimates) {
        const minutes =
          e.fixedMinutes ??
          (e.setupMinutes ?? 0) + (e.minutesPerUnit ?? 0);
        productEstimateMinutes[e.stageDefinitionId] = minutes;
      }
    }

    return compileWorkflow({
      nodes,
      edges,
      productOverrides,
      orderOverrides,
      productEstimateMinutes,
    });
  }

  async compileForProduct(
    versionId: string,
    productId: string | null | undefined,
    orderOverrides?: CompilerOrderOverride[],
    tx?: Tx,
  ) {
    const compiled = await this.compileForProductReport(versionId, productId, orderOverrides, tx);
    if (compiled.issues.length) {
      throw new BadRequestException({
        code: compiled.issues[0]?.code ?? 'WORKFLOW_INVALID_STAGE',
        message: compiled.issues[0]?.message ?? 'Compiled workflow is invalid.',
        issues: compiled.issues,
      });
    }
    return compiled;
  }

  private async audit(
    tx: Tx,
    userId: string | undefined,
    action: string,
    entityType: string,
    entityId: string,
    newValues: unknown,
  ) {
    await tx.auditEvent.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId,
        newValues: newValues as Prisma.InputJsonValue,
      },
    });
  }
}
