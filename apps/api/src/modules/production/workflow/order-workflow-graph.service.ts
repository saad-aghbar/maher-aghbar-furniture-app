import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../../common/prisma.service';
import { calculateWorkflowProgress } from './domain';
import { WorkflowSnapshotService } from './workflow-snapshot.service';
import { StagePipelineService } from '../stage-pipeline.service';

type Audience = 'admin' | 'dealer';

@Injectable()
export class OrderWorkflowGraphService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: WorkflowSnapshotService,
    private readonly pipeline: StagePipelineService,
  ) {}

  async getGraph(
    productionOrderId: string,
    audience: Audience,
    opts?: { customerId?: string | null },
  ) {
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      include: {
        stages: {
          include: {
            stageDefinition: true,
            tasks: {
              include: {
                assignedEmployee: {
                  select: { id: true, firstName: true, lastName: true },
                },
                blockers: { where: { resolvedAt: null } },
              },
            },
          },
        },
        schedules: {
          where: { status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW', 'PROVISIONAL'] } },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!po) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });

    if (audience === 'dealer') {
      if (!opts?.customerId || po.customerId !== opts.customerId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'You do not have access to this production order workflow.',
        });
      }
    }

    const snapshot = await this.snapshots.getSnapshot(productionOrderId);
    const stageByInstance = new Map(po.stages.map((s) => [s.id, s]));

    if (!snapshot) {
      if (!po.stages.length) {
        return {
          productionOrderId,
          progressPercent: 0,
          sourceVersionNumber: null,
          isLegacy: false,
          needsWorkflow: true,
          stages: [],
          edges: [],
        };
      }
      // Legacy fallback: project from stage instances + live dependsOnCodes
      const nodes = po.stages.map((s) => ({
        id: s.id,
        code: s.stageDefinition.code,
        localizedName: s.stageDefinition.nameEn,
        nameAr: s.stageDefinition.nameAr,
        nameEn: s.stageDefinition.nameEn,
        nameHe: s.stageDefinition.nameHe,
        status: s.status,
        progressPercent: s.progressPercent,
        isOptional: false,
        isSkipped: s.status === 'SKIPPED',
        level: undefined as number | undefined,
        ...(audience === 'admin'
          ? {
              assignedEmployee: s.tasks[0]?.assignedEmployee
                ? {
                    id: s.tasks[0].assignedEmployee.id,
                    name: `${s.tasks[0].assignedEmployee.firstName} ${s.tasks[0].assignedEmployee.lastName}`,
                  }
                : null,
              department: s.stageDefinition.responsibleDepartment,
              estimatedMinutes: s.tasks[0]?.estimatedMinutes ?? null,
              actualMinutes: s.tasks[0]?.actualMinutes ?? null,
              plannedStart: s.plannedStart,
              plannedEnd: s.plannedEnd,
              actualStart: s.actualStart,
              actualEnd: s.actualEnd,
              notes: s.notes,
              blockers: s.tasks.flatMap((t) => t.blockers),
              taskStatus: s.tasks[0]?.status ?? null,
            }
          : {}),
      }));
      const edges = po.stages.flatMap((s) =>
        (s.stageDefinition.dependsOnCodes ?? []).map((from) => ({ from, to: s.stageDefinition.code })),
      );
      const progressPercent =
        audience === 'dealer'
          ? po.progressPercent
          : calculateWorkflowProgress(
              nodes.map((n) => ({
                nodeKey: n.code,
                status: n.status,
                progressPercent: n.progressPercent,
                isSkipped: n.isSkipped,
              })),
            );
      return {
        productionOrderId,
        progressPercent,
        sourceVersionNumber: null,
        isLegacy: true,
        needsWorkflow: false,
        stages: audience === 'dealer' ? nodes.map(stripAdmin) : nodes,
        edges,
      };
    }

    const nodes = snapshot.nodes
      .filter((n) => !n.isSkipped || audience === 'admin')
      .map((n) => {
        const instance = n.stageInstanceId ? stageByInstance.get(n.stageInstanceId) : undefined;
        const status = n.isSkipped ? 'SKIPPED' : instance?.status ?? 'PENDING';
        const base = {
          id: n.id,
          code: n.stageCode,
          nodeKey: n.nodeKey,
          localizedName: n.nameEnSnapshot,
          nameAr: n.nameArSnapshot,
          nameEn: n.nameEnSnapshot,
          nameHe: n.nameHeSnapshot,
          status,
          progressPercent: instance?.progressPercent ?? (status === 'COMPLETED' ? 100 : 0),
          isOptional: !n.isRequired,
          isSkipped: n.isSkipped || status === 'SKIPPED',
          estimatedMinutes: n.estimatedMinutes,
          estimateReviewRequired: n.estimateReviewRequired,
        };
        if (audience === 'dealer') return base;
        const task = instance?.tasks[0];
        return {
          ...base,
          stageDefinitionId: n.stageDefinitionId,
          assignedEmployee: task?.assignedEmployee
            ? {
                id: task.assignedEmployee.id,
                name: `${task.assignedEmployee.firstName} ${task.assignedEmployee.lastName}`,
              }
            : null,
          department: n.responsibleDepartmentCode,
          actualMinutes: task?.actualMinutes ?? null,
          plannedStart: instance?.plannedStart ?? null,
          plannedEnd: instance?.plannedEnd ?? null,
          actualStart: instance?.actualStart ?? null,
          actualEnd: instance?.actualEnd ?? null,
          notes: instance?.notes ?? null,
          blockers: instance?.tasks.flatMap((t) => t.blockers) ?? [],
          taskStatus: task?.status ?? null,
          scheduleStatus: po.schedules[0]?.status ?? null,
          requiresInspection: n.requiresInspection,
          requiresPhotos: n.requiresPhotos,
        };
      });

    // Dealer never sees excluded/skipped-only placeholders preferred omitted
    const dealerNodes =
      audience === 'dealer' ? nodes.filter((n) => !n.isSkipped) : nodes;

    const nodeIdToCode = new Map(snapshot.nodes.map((n) => [n.id, n.stageCode]));
    const edges = snapshot.edges
      .map((e) => ({
        from: nodeIdToCode.get(e.fromSnapshotNodeId)!,
        to: nodeIdToCode.get(e.toSnapshotNodeId)!,
      }))
      .filter((e) => e.from && e.to)
      .filter((e) => {
        if (audience !== 'dealer') return true;
        const codes = new Set(dealerNodes.map((n) => n.code));
        return codes.has(e.from) && codes.has(e.to);
      });

    const progressPercent = calculateWorkflowProgress(
      snapshot.nodes.map((n) => {
        const instance = n.stageInstanceId ? stageByInstance.get(n.stageInstanceId) : undefined;
        return {
          nodeKey: n.nodeKey,
          status: n.isSkipped ? 'SKIPPED' : instance?.status ?? 'PENDING',
          estimatedMinutes: n.estimatedMinutes,
          progressPercent: instance?.progressPercent ?? 0,
          isSkipped: n.isSkipped,
        };
      }),
    );

    return {
      productionOrderId,
      progressPercent,
      sourceVersionNumber: snapshot.sourceVersionNumber,
      isLegacy: snapshot.isLegacyBackfill,
      needsWorkflow: false,
      stages: audience === 'dealer' ? dealerNodes.map(stripAdmin) : dealerNodes,
      edges,
    };
  }

  async skipOptionalNode(
    productionOrderId: string,
    snapshotNodeId: string,
    reason: string | undefined,
    userId: string,
  ) {
    const snapshot = await this.snapshots.getSnapshot(productionOrderId);
    if (!snapshot) {
      throw new BadRequestException({
        code: 'ORDER_WORKFLOW_LOCKED',
        message: 'Order has no workflow snapshot.',
      });
    }
    const node = snapshot.nodes.find((n) => n.id === snapshotNodeId);
    if (!node) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Snapshot node not found.' });
    if (node.isRequired) {
      throw new BadRequestException({
        code: 'ORDER_WORKFLOW_LOCKED',
        message: 'Required stages cannot be skipped.',
      });
    }
    if (node.stageInstanceId) {
      const instance = await this.prisma.productionStageInstance.findUnique({
        where: { id: node.stageInstanceId },
        include: { tasks: true },
      });
      if (instance && ['IN_PROGRESS', 'COMPLETED'].includes(instance.status)) {
        throw new BadRequestException({
          code: 'ORDER_WORKFLOW_LOCKED',
          message: 'Cannot skip a stage that has already started or completed.',
        });
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.productionOrderWorkflowSnapshotNode.update({
          where: { id: node.id },
          data: { isSkipped: true, skipReason: reason ?? 'SKIPPED_BY_ADMIN' },
        });
        await tx.productionStageInstance.update({
          where: { id: node.stageInstanceId! },
          data: { status: 'SKIPPED', progressPercent: 0 },
        });
        for (const task of instance?.tasks ?? []) {
          if (!['COMPLETED', 'CANCELLED'].includes(task.status)) {
            await tx.productionTask.update({
              where: { id: task.id },
              data: { status: 'CANCELLED' },
            });
          }
        }
        await tx.productionOrderWorkflowSnapshot.update({
          where: { id: snapshot.id },
          data: { customizedAt: new Date(), customizedById: userId },
        });
        await tx.auditEvent.create({
          data: {
            userId,
            action: 'workflow.order.stage.skipped',
            entityType: 'ProductionOrder',
            entityId: productionOrderId,
            newValues: { snapshotNodeId, reason } as Prisma.InputJsonValue,
          },
        });
      });
      await this.pipeline.unlockReadyStages(productionOrderId);
      await this.pipeline.rollupProgress(productionOrderId);
    }
    return this.getGraph(productionOrderId, 'admin');
  }
}

function stripAdmin<T extends Record<string, unknown>>(node: T) {
  const {
    assignedEmployee: _a,
    department: _d,
    actualMinutes: _am,
    plannedStart: _ps,
    plannedEnd: _pe,
    actualStart: _as,
    actualEnd: _ae,
    notes: _n,
    blockers: _b,
    taskStatus: _t,
    scheduleStatus: _s,
    requiresInspection: _ri,
    requiresPhotos: _rp,
    ...safe
  } = node as T & Record<string, unknown>;
  return safe;
}
