import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../../common/prisma.service';
import {
  livePercentFromTaskRow,
  liveTimingFromTaskRow,
  liveWorkflowProgressPercent,
} from '../../../common/helpers/live-task-progress';
import { WorkflowSnapshotService } from './workflow-snapshot.service';
import { StagePipelineService } from '../stage-pipeline.service';
import { FloorHandoffService } from '../../notifications/floor-handoff.service';
import { emptyPipelineFacts } from '../pipeline-handoff';
import { isReleasedToFactory } from '../factory-release';
import { isQualityGateStage } from '../../scheduling/domain/milestone';

type Audience = 'admin' | 'dealer';

type GraphTask = {
  id: string;
  status: string;
  actualMinutes?: number | null;
  estimatedMinutes?: number | null;
  plannedCompletion?: Date | string | null;
  assignedEmployee?: { id: string; firstName: string; lastName: string } | null;
  blockers?: unknown[];
  timeEntries?: Array<{ startedAt: Date | string; endedAt?: Date | string | null }>;
};

function liveStagePercentForAudience(
  audience: Audience,
  status: string,
  stored: number | null | undefined,
  tasks: GraphTask[] | undefined,
): number {
  if (audience === 'dealer') {
    return stored ?? (status === 'COMPLETED' || status === 'DONE' ? 100 : 0);
  }
  const upper = status.toUpperCase();
  if (upper === 'COMPLETED' || upper === 'DONE') return 100;
  if (!tasks?.length) return stored ?? 0;
  return Math.round(
    tasks.reduce((sum, task) => sum + livePercentFromTaskRow(task), 0) / tasks.length,
  );
}

function adminTimerFields(task: GraphTask | undefined) {
  if (!task) {
    return {
      elapsedMinutes: 0,
      actualSeconds: 0,
      openStartedAt: null as string | null,
      running: false,
    };
  }
  const timing = liveTimingFromTaskRow(task);
  return {
    elapsedMinutes: timing.elapsedMinutes,
    actualSeconds: timing.actualSeconds,
    openStartedAt: timing.openStartedAt,
    running: timing.status === 'running',
    estimatedMinutes: timing.estimatedMinutes ?? task.estimatedMinutes ?? null,
  };
}

@Injectable()
export class OrderWorkflowGraphService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: WorkflowSnapshotService,
    private readonly pipeline: StagePipelineService,
    @Optional() private readonly floorHandoff?: FloorHandoffService,
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
                timeEntries: {
                  orderBy: { startedAt: 'desc' as const },
                  select: { startedAt: true, endedAt: true },
                },
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
    const latestInspection = await this.prisma.qualityInspection.findFirst({
      where: { productionOrderId },
      include: { rework: { include: { reentryStageInstance: { include: { stageDefinition: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    const reworkBackCodes = [
      ...new Set(
        (latestInspection?.rework ?? [])
          .filter((r) => r.status !== 'COMPLETED')
          .map((r) => r.reentryStageInstance?.stageDefinition?.code)
          .filter((c): c is string => Boolean(c)),
      ),
    ];

    if (!snapshot) {
      if (!po.stages.length) {
        return {
          productionOrderId,
          progressPercent: 0,
          sourceVersionNumber: null,
          isLegacy: false,
          needsWorkflow: true,
          planEditable: !isReleasedToFactory(po),
          stages: [],
          edges: [],
        };
      }
      // Legacy fallback: project from stage instances + live dependsOnCodes
      const nodes = po.stages
        .filter((s) => s.stageDefinition)
        .map((s) => {
        const timer = audience === 'admin' ? adminTimerFields(s.tasks[0]) : null;
        const qualityGate = isQualityGateStage({
          code: s.stageDefinition.code,
          executionKind: s.stageDefinition.executionKind,
        });
        const estimatedMinutes = qualityGate
          ? 0
          : timer?.estimatedMinutes ?? s.tasks[0]?.estimatedMinutes ?? null;
        return {
        id: s.id,
        code: s.stageDefinition.code,
        localizedName: s.stageDefinition.nameEn,
        nameAr: s.stageDefinition.nameAr,
        nameEn: s.stageDefinition.nameEn,
        nameHe: s.stageDefinition.nameHe,
        status: s.status,
        progressPercent: liveStagePercentForAudience(
          audience,
          s.status,
          s.progressPercent,
          s.tasks,
        ),
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
              taskId: s.tasks[0]?.id ?? null,
              department: s.stageDefinition.responsibleDepartment,
              estimatedMinutes,
              estimateReviewRequired: qualityGate ? false : undefined,
              actualMinutes: s.tasks[0]?.actualMinutes ?? null,
              elapsedMinutes: timer?.elapsedMinutes ?? 0,
              actualSeconds: timer?.actualSeconds ?? 0,
              openStartedAt: timer?.openStartedAt ?? null,
              running: timer?.running ?? false,
              plannedStart: s.plannedStart,
              plannedEnd: s.plannedEnd,
              actualStart: s.actualStart,
              actualEnd: s.actualEnd,
              notes: s.notes,
              blockers: s.tasks.flatMap((t) => t.blockers),
              taskStatus: s.tasks[0]?.status ?? null,
              inspectionStatus: (s as { inspectionStatus?: string | null }).inspectionStatus ?? null,
              inspectionProgress: null,
              backForRework: reworkBackCodes.includes(s.stageDefinition.code),
            }
          : {
              estimatedMinutes,
              estimateReviewRequired: qualityGate ? false : undefined,
              inspectionProgress: null,
              backForRework: reworkBackCodes.includes(s.stageDefinition.code),
            }),
      };
      });
      const edges = po.stages.flatMap((s) =>
        (s.stageDefinition?.dependsOnCodes ?? []).map((from) => ({
          from,
          to: s.stageDefinition?.code ?? '',
        })),
      ).filter((e) => e.to);
      const progressPercent =
        audience === 'dealer'
          ? po.progressPercent
          : liveWorkflowProgressPercent(
              nodes.map((n) => ({
                status: n.status,
                progressPercent: n.progressPercent,
                estimatedMinutes: n.estimatedMinutes,
                isSkipped: n.isSkipped,
              })),
            );
      return {
        productionOrderId,
        progressPercent,
        sourceVersionNumber: null,
        isLegacy: true,
        needsWorkflow: false,
        planEditable: !isReleasedToFactory(po),
        stages: audience === 'dealer' ? nodes.map(stripAdmin) : nodes,
        edges,
      };
    }

    const nodes = snapshot.nodes
      .filter((n) => !n.isSkipped || audience === 'admin')
      .map((n) => {
        const instance = n.stageInstanceId ? stageByInstance.get(n.stageInstanceId) : undefined;
        const status = n.isSkipped ? 'SKIPPED' : instance?.status ?? 'PENDING';
        const qualityGate = isQualityGateStage({
          code: n.stageCode,
          executionKind: n.executionKind,
        });
        const backForRework = reworkBackCodes.includes(n.stageCode);
        const base = {
          id: n.id,
          code: n.stageCode,
          nodeKey: n.nodeKey,
          localizedName: n.nameEnSnapshot,
          nameAr: n.nameArSnapshot,
          nameEn: n.nameEnSnapshot,
          nameHe: n.nameHeSnapshot,
          status,
          progressPercent: liveStagePercentForAudience(
            audience,
            status,
            instance?.progressPercent,
            instance?.tasks,
          ),
          isOptional: !n.isRequired,
          isSkipped: n.isSkipped || status === 'SKIPPED',
          estimatedMinutes: qualityGate ? 0 : n.estimatedMinutes,
          estimateReviewRequired: qualityGate ? false : n.estimateReviewRequired,
          inspectionStatus: instance?.inspectionStatus ?? null,
          inspectionProgress: null,
          backForRework,
        };
        if (audience === 'dealer') return base;
        const task = instance?.tasks[0];
        const timer = adminTimerFields(task);
        return {
          ...base,
          estimatedMinutes: qualityGate ? 0 : (timer.estimatedMinutes ?? n.estimatedMinutes),
          stageDefinitionId: n.stageDefinitionId,
          assignedEmployee: task?.assignedEmployee
            ? {
                id: task.assignedEmployee.id,
                name: `${task.assignedEmployee.firstName} ${task.assignedEmployee.lastName}`,
              }
            : null,
          taskId: task?.id ?? null,
          department: n.responsibleDepartmentCode,
          actualMinutes: task?.actualMinutes ?? null,
          elapsedMinutes: timer.elapsedMinutes,
          actualSeconds: timer.actualSeconds,
          openStartedAt: timer.openStartedAt,
          running: timer.running,
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

    const progressPercent =
      audience === 'dealer'
        ? po.progressPercent
        : liveWorkflowProgressPercent(
            snapshot.nodes.map((n) => {
              const instance = n.stageInstanceId ? stageByInstance.get(n.stageInstanceId) : undefined;
              const status = n.isSkipped ? 'SKIPPED' : instance?.status ?? 'PENDING';
              return {
                status,
                estimatedMinutes: n.estimatedMinutes,
                progressPercent: liveStagePercentForAudience(
                  'admin',
                  status,
                  instance?.progressPercent,
                  instance?.tasks,
                ),
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
      planEditable: !isReleasedToFactory(po),
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
      const facts = emptyPipelineFacts(productionOrderId);
      facts.newlyReadyTasks = await this.pipeline.unlockReadyStages(productionOrderId);
      const rollup = await this.pipeline.rollupProgress(productionOrderId);
      facts.poBecameReadyForDelivery = rollup.poBecameReadyForDelivery;
      facts.soBecameReadyForDelivery = rollup.soBecameReadyForDelivery;
      facts.salesOrderId = rollup.salesOrderId;
      facts.deliveryId = rollup.deliveryId;
      await this.floorHandoff?.emitPipeline(facts, { actorUserId: userId });
    }
    return this.getGraph(productionOrderId, 'admin');
  }
}

function stripAdmin<T extends Record<string, unknown>>(node: T) {
  const {
    assignedEmployee: _a,
    taskId: _taskId,
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
    elapsedMinutes: _em,
    actualSeconds: _asec,
    openStartedAt: _osa,
    running: _run,
    ...safe
  } = node as T & Record<string, unknown>;
  return safe;
}
