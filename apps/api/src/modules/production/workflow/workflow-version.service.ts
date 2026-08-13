import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../../common/prisma.service';
import {
  compileWorkflow,
  validateWorkflowGraph,
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
      const node = await tx.productionWorkflowNode.update({
        where: { id: nodeId },
        data: rest,
      });
      if (runsAfterNodeIds) {
        await tx.productionWorkflowEdge.deleteMany({
          where: { workflowVersionId: versionId, toNodeId: nodeId },
        });
        for (const fromNodeId of runsAfterNodeIds) {
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

  async removeNode(
    versionId: string,
    nodeId: string,
    options: { reconnect?: boolean; expectedRevision?: number },
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDraftMutable(versionId, tx);
      await this.bumpRevision(versionId, options.expectedRevision, tx);
      const incoming = await tx.productionWorkflowEdge.findMany({
        where: { workflowVersionId: versionId, toNodeId: nodeId },
      });
      const outgoing = await tx.productionWorkflowEdge.findMany({
        where: { workflowVersionId: versionId, fromNodeId: nodeId },
      });
      if (options.reconnect !== false) {
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
      await this.audit(tx, userId, 'workflow.node.removed', 'ProductionWorkflowNode', nodeId, options);
      return { ok: true };
    });
  }

  async validateVersion(versionId: string) {
    const version = await this.prisma.productionWorkflowVersion.findUnique({
      where: { id: versionId },
      include: { nodes: true, edges: true },
    });
    if (!version) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version not found.' });
    return validateWorkflowGraph(
      version.nodes.map((n) => ({ id: n.id, nodeKey: n.nodeKey })),
      version.edges.map((e) => ({ fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
    );
  }

  async publish(versionId: string, userId?: string, expectedRevision?: number) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.productionWorkflowVersion.findUnique({
        where: { id: versionId },
        include: { nodes: true, edges: true },
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

      const validation = validateWorkflowGraph(
        version.nodes.map((n) => ({ id: n.id, nodeKey: n.nodeKey })),
        version.edges.map((e) => ({ fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
      );
      if (!validation.ok) {
        throw new BadRequestException({
          code: validation.issues[0]?.code ?? 'WORKFLOW_INVALID_STAGE',
          message: validation.issues[0]?.message ?? 'Workflow validation failed.',
          issues: validation.issues,
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

  async compileForProduct(
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
        // Prefer fixedMinutes or setup+linear unit estimate as minutesPerUnit for qty=1 baseline
        const minutes =
          e.fixedMinutes ??
          (e.setupMinutes ?? 0) + (e.minutesPerUnit ?? 0);
        productEstimateMinutes[e.stageDefinitionId] = minutes;
      }
    }

    const compiled = compileWorkflow({
      nodes,
      edges,
      productOverrides,
      orderOverrides,
      productEstimateMinutes,
    });
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
