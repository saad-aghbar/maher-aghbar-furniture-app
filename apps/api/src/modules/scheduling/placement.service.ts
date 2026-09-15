import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { FloorHandoffService } from '../notifications/floor-handoff.service';
import { OpsNotifyService } from '../notifications/ops-notify.service';
import { intervalsOverlap } from '../production/worker-recommend';
import { DEFAULT_FACTORY_TIMEZONE } from './domain/dealer-request-lead';
import { ymdInTimezone } from './domain/factory-replan';
import { classifyPersistIssue, type PersistClass } from './domain/manual-control';
import { WorkingCalendar } from './domain/working-calendar';
import type { FactoryCalendarInput, TimeOfDayRange } from './domain/types';

const LOCKED_TASK = [
  'COMPLETED',
  'CANCELLED',
  'IN_PROGRESS',
  'PAUSED',
  'READY_FOR_INSPECTION',
  'BLOCKED',
];
const LOCKED_STAGE = [
  'COMPLETED',
  'SKIPPED',
  'IN_PROGRESS',
  'PAUSED',
  'READY_FOR_INSPECTION',
  'BLOCKED',
];
const OPEN_TASK = [
  'NOT_STARTED',
  'READY',
  'IN_PROGRESS',
  'PAUSED',
  'BLOCKED',
  'READY_FOR_INSPECTION',
] as const;
const ACTIVE_SCHEDULE = ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] as const;
const ON_FLOOR_ORDER = ['IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_PACKAGING'];

export type PlacementIssue = {
  code: string;
  class: PersistClass;
  message: string;
  start?: string;
  end?: string;
  label?: string;
};

export type PlaceTaskInput = {
  productionTaskId: string;
  employeeId?: string | null;
  plannedStart?: Date | string | null;
  plannedEnd?: Date | string | null;
  priority?: string;
  estimatedMinutes?: number | null;
  acknowledge?: boolean;
  override?: boolean;
  reason?: string;
  actorUserId?: string;
  permissions?: string[];
  allocationId?: string;
  productionOrderId?: string;
  version?: number;
  isPinned?: boolean;
  sortOrder?: number;
};

export type PlaceTaskResult = {
  task: Record<string, unknown>;
  allocationId: string | null;
  scheduleId: string | null;
  issues: PlacementIssue[];
};

function parseInstant(value: Date | string | null | undefined, field: string): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      code: 'BAD_REQUEST',
      message: `${field} must be a valid ISO datetime.`,
    });
  }
  return date;
}

function issueMessage(code: string, fallback: string): string {
  switch (code) {
    case 'DEPENDENCY_ORDER':
      return fallback;
    case 'WORKER_OVERLAP':
    case 'WORKER_DOUBLE_BOOKED':
    case 'WORKER_SCHEDULE_CONFLICT':
      return fallback;
    case 'WORKER_NOT_ELIGIBLE':
    case 'WORKER_SKILL_REQUIRED':
    case 'MANDATORY_SKILL':
      return fallback || 'Worker does not have the required skill for this stage.';
    case 'NON_WORKING_START':
    case 'FACTORY_CLOSED':
    case 'FACTORY_CLOSED_EXECUTION':
      return fallback || 'The factory is closed at this time.';
    case 'INVALID_TIME_RANGE':
    case 'INVALID_WINDOW':
      return fallback || 'plannedEnd must be after plannedStart.';
    default:
      return fallback;
  }
}

@Injectable()
export class PlacementService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly floorHandoff?: FloorHandoffService,
    @Optional() private readonly opsNotify?: OpsNotifyService,
  ) {}

  async placeTask(input: PlaceTaskInput): Promise<PlaceTaskResult> {
    const permissions = input.permissions ?? [];
    const task = await this.prisma.productionTask.findUnique({
      where: { id: input.productionTaskId },
      include: {
        stageDefinition: true,
        stageInstance: true,
        productionOrder: true,
      },
    });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });

    const orderStatus = task.productionOrder?.status;
    if (orderStatus === 'COMPLETED' || orderStatus === 'CANCELLED') {
      throw new BadRequestException({
        code: 'ASSIGN_LOCKED',
        message: 'Cannot assign workers on a completed or cancelled production order.',
      });
    }

    const stageStatus = task.stageInstance?.status;
    if (LOCKED_TASK.includes(task.status) || (stageStatus && LOCKED_STAGE.includes(stageStatus))) {
      throw new BadRequestException({
        code: 'ASSIGN_LOCKED',
        message: 'Cannot reassign this stage — it is already in progress, completed, or otherwise locked.',
      });
    }

    const nextEmployeeId = input.employeeId === undefined ? task.assignedEmployeeId : input.employeeId;
    if (
      task.assignedEmployeeId &&
      nextEmployeeId &&
      task.assignedEmployeeId !== nextEmployeeId &&
      orderStatus &&
      ON_FLOOR_ORDER.includes(orderStatus)
    ) {
      throw new BadRequestException({
        code: 'REASSIGN_LOCKED',
        message: 'Cannot reassign after the production order is on the floor. Pause or complete the stage first.',
      });
    }

    if (nextEmployeeId) {
      await this.assertEligibleWorker(nextEmployeeId, task.stageDefinitionId ?? task.stageDefinition?.id ?? null);
    }

    const plannedStart = parseInstant(input.plannedStart, 'plannedStart') ?? task.plannedStart;
    const plannedEnd =
      parseInstant(input.plannedEnd ?? undefined, 'plannedEnd') ??
      parseInstant(
        (input as { plannedCompletion?: Date | string | null }).plannedCompletion,
        'plannedCompletion',
      ) ??
      task.plannedCompletion;

    if (input.plannedStart && !input.plannedEnd && !(input as { plannedCompletion?: string }).plannedCompletion) {
      throw new BadRequestException({
        code: 'DATE_INCOMPLETE',
        message: 'When plannedStart is set, plannedCompletion is required.',
      });
    }

    const issues: PlacementIssue[] = [];

    if (plannedStart && plannedEnd && plannedStart.getTime() > plannedEnd.getTime()) {
      issues.push({
        code: 'INVALID_TIME_RANGE',
        class: classifyPersistIssue('INVALID_TIME_RANGE'),
        message: issueMessage('INVALID_TIME_RANGE', 'plannedStart must be before plannedCompletion.'),
      });
    } else if (
      plannedStart &&
      plannedEnd &&
      plannedStart.getTime() === plannedEnd.getTime() &&
      nextEmployeeId
    ) {
      issues.push({
        code: 'INVALID_TIME_RANGE',
        class: classifyPersistIssue('INVALID_TIME_RANGE'),
        message: issueMessage('INVALID_TIME_RANGE', 'plannedStart must be before plannedCompletion.'),
      });
    }

    if (plannedStart && plannedEnd) {
      await this.collectDependencyIssues(task, plannedStart, issues);
      if (nextEmployeeId) {
        await this.collectOverlapIssues(task.id, nextEmployeeId, plannedStart, plannedEnd, issues);
      }
      await this.collectCalendarIssues(plannedStart, plannedEnd, issues);
    }

    this.throwIfBlocked(issues, {
      acknowledge: input.acknowledge,
      override: input.override,
      permissions,
    });

    const estimatedMinutes =
      input.estimatedMinutes ??
      task.estimatedMinutes ??
      (plannedStart && plannedEnd
        ? Math.max(1, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000))
        : null);

    const written = await this.persistPlacement({
      task,
      employeeId: nextEmployeeId ?? null,
      plannedStart,
      plannedEnd,
      estimatedMinutes,
      priority: input.priority,
      allocationId: input.allocationId,
      version: input.version,
      isPinned: input.isPinned,
      sortOrder: input.sortOrder,
      actorUserId: input.actorUserId,
      reason: input.reason,
      override: input.override,
    });

    await this.notifyPlacementChange({
      task,
      nextEmployeeId: nextEmployeeId ?? null,
      plannedStart,
      actorUserId: input.actorUserId ?? null,
    });

    return { ...written, issues };
  }

  async clearPlacement(input: {
    productionTaskId: string;
    actorUserId?: string;
    reason?: string;
  }): Promise<PlaceTaskResult> {
    const task = await this.prisma.productionTask.findUnique({
      where: { id: input.productionTaskId },
      include: { stageInstance: true, productionOrder: true, stageDefinition: true },
    });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });
    if (LOCKED_TASK.includes(task.status)) {
      throw new BadRequestException({
        code: 'ASSIGN_LOCKED',
        message: 'Cannot clear a started or completed placement.',
      });
    }

    const schedule = await this.prisma.productionSchedule.findFirst({
      where: {
        productionOrderId: task.productionOrderId,
        status: { in: [...ACTIVE_SCHEDULE] },
      },
      orderBy: { version: 'desc' },
      include: { allocations: true },
    });
    const allocation = schedule?.allocations.find((a) => a.productionTaskId === task.id) ?? null;

    await this.prisma.$transaction(async (tx) => {
      if (allocation) {
        await tx.scheduleAllocation.delete({ where: { id: allocation.id } });
        await tx.scheduleChangeHistory.create({
          data: {
            productionOrderId: task.productionOrderId,
            allocationId: allocation.id,
            kind: 'clear-placement',
            oldEmployeeId: allocation.employeeId,
            oldStart: allocation.plannedStart,
            oldEnd: allocation.plannedEnd,
            actorId: input.actorUserId ?? 'system',
            reason: input.reason ?? null,
          },
        });
      }
      await tx.productionTask.update({
        where: { id: task.id },
        data: { assignedEmployeeId: null, plannedStart: null, plannedCompletion: null },
      });
    });

    const updated = await this.prisma.productionTask.findUniqueOrThrow({
      where: { id: task.id },
      include: {
        assignedEmployee: { select: { id: true, firstName: true, lastName: true, email: true } },
        stageDefinition: true,
        productionOrder: { select: { id: true, number: true, releasedToFactoryAt: true } },
      },
    });
    return { task: updated, allocationId: null, scheduleId: schedule?.id ?? null, issues: [] };
  }

  private throwIfBlocked(
    issues: PlacementIssue[],
    opts: { acknowledge?: boolean; override?: boolean; permissions: string[] },
  ) {
    const hard = issues.filter((i) => i.class === 'hard_block');
    if (hard.length) {
      const first = hard[0]!;
      throw new BadRequestException({
        code: first.code,
        message: first.message,
        issues: hard,
      });
    }
    const warnings = issues.filter((i) => i.class === 'warning');
    if (!warnings.length) return;
    const canOverride = Boolean(opts.override) && opts.permissions.includes('schedule.override');
    if (opts.acknowledge || canOverride) return;
    const first = warnings[0]!;
    throw new ConflictException({
      code: first.code === 'WORKER_DOUBLE_BOOKED' ? 'WORKER_SCHEDULE_CONFLICT' : first.code,
      message: first.message,
      issues: warnings,
      conflicts: warnings
        .filter((w) => w.start && w.end)
        .map((w) => ({
          kind: 'TASK' as const,
          id: w.label ?? w.code,
          label: w.label ?? w.message,
          start: w.start,
          end: w.end,
        })),
      overrideRequires: 'schedule.override',
    });
  }

  private async assertEligibleWorker(employeeId: string, stageDefinitionId: string | null) {
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, isActive: true, archivedAt: null },
      include: {
        roles: { include: { role: { select: { kind: true } } } },
        workerSkills: { where: { isActive: true }, select: { stageDefinitionId: true } },
      },
    });
    if (!employee) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Employee not found.' });
    }
    if (!employee.roles.some((r) => r.role.kind === 'PRODUCTION_WORKER')) {
      throw new BadRequestException({
        code: 'WORKER_NOT_ELIGIBLE',
        message: 'Only active production workers can be assigned to floor stages.',
      });
    }
    if (!stageDefinitionId) return;
    const skillCount = await this.prisma.workerSkill.count({
      where: { stageDefinitionId, isActive: true },
    });
    if (skillCount === 0) return;
    const hasSkill = employee.workerSkills.some((s) => s.stageDefinitionId === stageDefinitionId);
    if (!hasSkill) {
      throw new BadRequestException({
        code: 'WORKER_SKILL_REQUIRED',
        message: 'Worker does not have the required skill for this stage.',
      });
    }
  }

  private async collectDependencyIssues(
    task: {
      id: string;
      productionOrderId: string;
      stageDefinition?: { dependsOnCodes?: string[] | null; code?: string | null; nameEn?: string | null } | null;
    },
    plannedStart: Date,
    issues: PlacementIssue[],
  ) {
    const depCodes = task.stageDefinition?.dependsOnCodes ?? [];
    if (!depCodes.length) return;
    const siblings = await this.prisma.productionTask.findMany({
      where: {
        productionOrderId: task.productionOrderId,
        id: { not: task.id },
        status: { not: 'CANCELLED' },
        isRework: false,
        stageDefinition: { code: { in: depCodes } },
      },
      select: {
        plannedCompletion: true,
        plannedStart: true,
        stageDefinition: { select: { code: true, nameEn: true } },
      },
    });
    let latest: { end: Date; label: string } | null = null;
    for (const pred of siblings) {
      const predEnd = pred.plannedCompletion ?? pred.plannedStart;
      if (!predEnd) continue;
      if (!latest || predEnd.getTime() > latest.end.getTime()) {
        latest = {
          end: predEnd,
          label: pred.stageDefinition?.nameEn ?? pred.stageDefinition?.code ?? 'predecessor',
        };
      }
    }
    if (latest && plannedStart.getTime() < latest.end.getTime()) {
      const stage = task.stageDefinition?.nameEn ?? task.stageDefinition?.code ?? 'This stage';
      issues.push({
        code: 'DEPENDENCY_ORDER',
        class: classifyPersistIssue('DEPENDENCY_ORDER'),
        message: `${stage} cannot start before ${latest.label} ends.`,
        start: latest.end.toISOString(),
        label: latest.label,
      });
    }
  }

  private async collectOverlapIssues(
    taskId: string,
    employeeId: string,
    windowStart: Date,
    windowEnd: Date,
    issues: PlacementIssue[],
  ) {
    const otherTasks = await this.prisma.productionTask.findMany({
      where: {
        assignedEmployeeId: employeeId,
        id: { not: taskId },
        status: { in: [...OPEN_TASK] },
        productionOrder: { archivedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        OR: [
          { plannedStart: { not: null }, plannedCompletion: { not: null } },
          { plannedCompletion: { not: null }, plannedStart: null },
        ],
      },
      select: {
        id: true,
        name: true,
        plannedStart: true,
        plannedCompletion: true,
        productionOrder: { select: { number: true } },
        assignedEmployee: { select: { firstName: true, lastName: true } },
      },
    });
    for (const other of otherTasks) {
      const oEnd = other.plannedCompletion;
      if (!oEnd) continue;
      const oStart = other.plannedStart ?? new Date(oEnd.getTime() - 60 * 60 * 1000);
      if (!intervalsOverlap(windowStart, windowEnd, oStart, oEnd)) continue;
      const worker = [other.assignedEmployee?.firstName, other.assignedEmployee?.lastName]
        .filter(Boolean)
        .join(' ');
      const hm = (d: Date) => d.toISOString().slice(11, 16);
      issues.push({
        code: 'WORKER_DOUBLE_BOOKED',
        class: classifyPersistIssue('WORKER_DOUBLE_BOOKED'),
        message: `${worker || 'This worker'} already has another task from ${hm(oStart)} to ${hm(oEnd)}.`,
        start: oStart.toISOString(),
        end: oEnd.toISOString(),
        label: `${other.productionOrder?.number ?? ''} ${other.name}`.trim(),
      });
    }

    const allocations = await this.prisma.scheduleAllocation.findMany({
      where: {
        employeeId,
        productionTaskId: { not: taskId },
        schedule: { status: { in: ['APPROVED', 'PROPOSED'] } },
        plannedStart: { lt: windowEnd },
        plannedEnd: { gt: windowStart },
      },
      select: {
        id: true,
        plannedStart: true,
        plannedEnd: true,
        productionTask: { select: { name: true, number: true } },
      },
      take: 20,
    });
    for (const a of allocations) {
      if (!intervalsOverlap(windowStart, windowEnd, a.plannedStart, a.plannedEnd)) continue;
      const hm = (d: Date) => d.toISOString().slice(11, 16);
      issues.push({
        code: 'WORKER_OVERLAP',
        class: classifyPersistIssue('WORKER_OVERLAP'),
        message: `This worker already has another task from ${hm(a.plannedStart)} to ${hm(a.plannedEnd)}.`,
        start: a.plannedStart.toISOString(),
        end: a.plannedEnd.toISOString(),
        label: a.productionTask?.name ?? a.productionTask?.number ?? 'Scheduled work',
      });
    }
  }

  private async collectCalendarIssues(plannedStart: Date, plannedEnd: Date, issues: PlacementIssue[]) {
    const calendar = await this.loadWorkingCalendar();
    if (!calendar) return;
    const startYmd = calendar.localYmd(plannedStart);
    const intervals = calendar.intervalsForLocalYmd(startYmd);
    if (!intervals.length) {
      issues.push({
        code: 'FACTORY_CLOSED_EXECUTION',
        class: classifyPersistIssue('FACTORY_CLOSED_EXECUTION'),
        message: `The factory is closed on ${startYmd}.`,
      });
      return;
    }
    if (!calendar.isWorking(plannedStart)) {
      issues.push({
        code: 'NON_WORKING_START',
        class: classifyPersistIssue('NON_WORKING_START'),
        message: 'Assignment starts outside the available working window.',
      });
    }
    void plannedEnd;
  }

  private async loadWorkingCalendar(): Promise<WorkingCalendar | null> {
    const findFirst = this.prisma.factoryCalendar?.findFirst;
    if (typeof findFirst !== 'function') return null;
    const row = await findFirst.call(this.prisma.factoryCalendar, { where: { isDefault: true } });
    if (!row) {
      return new WorkingCalendar({
        timezone: 'Asia/Amman',
        workingWeekdays: [0, 1, 2, 3, 4, 6],
        shiftStart: '08:00',
        shiftEnd: '16:00',
        breaks: [{ start: '12:00', end: '12:30' }],
        exceptions: [],
      });
    }
    const exceptions = this.prisma.factoryCalendarException?.findMany
      ? await this.prisma.factoryCalendarException.findMany({
          where: { calendarId: row.id },
        })
      : [];
    const input: FactoryCalendarInput = {
      timezone: row.timezone,
      workingWeekdays: row.workingWeekdays,
      shiftStart: row.shiftStart,
      shiftEnd: row.shiftEnd,
      breaks: (row.breaks as TimeOfDayRange[] | null) ?? [],
      exceptions: exceptions.map((e) => ({
        date: e.date,
        type: e.type,
        shiftStart: e.shiftStart,
        shiftEnd: e.shiftEnd,
        note: e.note,
        overtimeEmployeeIds: Array.isArray(e.overtimeEmployeeIds)
          ? (e.overtimeEmployeeIds as string[])
          : [],
      })),
    };
    return new WorkingCalendar(input);
  }

  private async persistPlacement(opts: {
    task: {
      id: string;
      productionOrderId: string;
      assignedEmployeeId: string | null;
      plannedStart: Date | null;
      plannedCompletion: Date | null;
      productionOrder?: { plannedStartDate?: Date | null } | null;
    };
    employeeId: string | null;
    plannedStart: Date | null;
    plannedEnd: Date | null;
    estimatedMinutes: number | null;
    priority?: string;
    allocationId?: string;
    version?: number;
    isPinned?: boolean;
    sortOrder?: number;
    actorUserId?: string;
    reason?: string | null;
    override?: boolean;
  }): Promise<PlaceTaskResult> {
    const hasWindow = Boolean(opts.plannedStart && opts.plannedEnd);
    const scheduleDelegate = this.prisma.productionSchedule;
    const canWriteSchedule = hasWindow && typeof scheduleDelegate?.findFirst === 'function';

    let scheduleId: string | null = null;
    let allocationId: string | null = opts.allocationId ?? null;

    if (canWriteSchedule) {
      const latest = await this.prisma.productionSchedule.findFirst({
        where: {
          productionOrderId: opts.task.productionOrderId,
          status: { in: [...ACTIVE_SCHEDULE] },
        },
        orderBy: { version: 'desc' },
        include: { allocations: true },
      });
      if (opts.version != null && latest && latest.version !== opts.version) {
        throw new ConflictException({
          code: 'SCHEDULE_STALE',
          message: `Schedule has changed since you loaded it (current version ${latest.version}).`,
          currentVersion: latest.version,
        });
      }

      const minutes = Math.max(
        1,
        opts.estimatedMinutes ??
          Math.round((opts.plannedEnd!.getTime() - opts.plannedStart!.getTime()) / 60_000),
      );

      await this.prisma.$transaction(async (tx) => {
        let schedule = latest;
        if (!schedule) {
          const anyLatest = await tx.productionSchedule.findFirst({
            where: { productionOrderId: opts.task.productionOrderId },
            orderBy: { version: 'desc' },
          });
          schedule = await tx.productionSchedule.create({
            data: {
              productionOrderId: opts.task.productionOrderId,
              version: (anyLatest?.version ?? 0) + 1,
              status: 'PROPOSED',
              promiseState: 'AWAITING_APPROVAL',
              planningMode: 'FORWARD',
              reason: opts.reason ?? 'manual-place',
              generatedBy: opts.actorUserId ?? undefined,
            },
            include: { allocations: true },
          });
        }
        scheduleId = schedule.id;
        const existing =
          (opts.allocationId
            ? schedule.allocations.find((a) => a.id === opts.allocationId)
            : schedule.allocations.find((a) => a.productionTaskId === opts.task.id)) ?? null;

        const allocation = existing
          ? await tx.scheduleAllocation.update({
              where: { id: existing.id },
              data: {
                plannedStart: opts.plannedStart!,
                plannedEnd: opts.plannedEnd!,
                employeeId: opts.employeeId,
                estimatedMinutes: minutes,
                isPinned: opts.isPinned ?? existing.isPinned,
                sortOrder: opts.sortOrder ?? existing.sortOrder,
                manuallyAdjusted: true,
                attentionCode: null,
              },
            })
          : await tx.scheduleAllocation.create({
              data: {
                scheduleId: schedule.id,
                productionTaskId: opts.task.id,
                resourceType: 'EMPLOYEE',
                employeeId: opts.employeeId,
                plannedStart: opts.plannedStart!,
                plannedEnd: opts.plannedEnd!,
                estimatedMinutes: minutes,
                isPinned: opts.isPinned ?? false,
                sortOrder: opts.sortOrder ?? (schedule.allocations.length ?? 0),
                manuallyAdjusted: true,
              },
            });
        allocationId = allocation.id;

        await tx.productionTask.update({
          where: { id: opts.task.id },
          data: {
            assignedEmployeeId: opts.employeeId,
            ...(opts.priority ? { priority: opts.priority as never } : {}),
            plannedStart: opts.plannedStart,
            plannedCompletion: opts.plannedEnd,
            ...(opts.estimatedMinutes != null ? { estimatedMinutes: opts.estimatedMinutes } : {}),
          },
        });

        const po = await tx.productionOrder.findUnique({
          where: { id: opts.task.productionOrderId },
          select: { plannedStartDate: true },
        });
        await tx.productionOrder.update({
          where: { id: opts.task.productionOrderId },
          data: {
            ...(!po?.plannedStartDate && opts.plannedStart ? { plannedStartDate: opts.plannedStart } : {}),
            ...(opts.plannedEnd ? { plannedCompletionDate: opts.plannedEnd } : {}),
          },
        });

        await tx.scheduleChangeHistory.create({
          data: {
            productionOrderId: opts.task.productionOrderId,
            allocationId: allocation.id,
            kind: opts.override ? 'override' : existing ? 'allocation' : 'place',
            oldEmployeeId: existing?.employeeId ?? opts.task.assignedEmployeeId,
            newEmployeeId: opts.employeeId,
            oldStart: existing?.plannedStart ?? opts.task.plannedStart,
            newStart: opts.plannedStart,
            oldEnd: existing?.plannedEnd ?? opts.task.plannedCompletion,
            newEnd: opts.plannedEnd,
            actorId: opts.actorUserId ?? 'system',
            reason: opts.reason ?? null,
          },
        });
      });
    } else {
      const updatedOnly = await this.prisma.productionTask.update({
        where: { id: opts.task.id },
        data: {
          assignedEmployeeId: opts.employeeId,
          ...(opts.priority ? { priority: opts.priority as never } : {}),
          ...(opts.plannedStart ? { plannedStart: opts.plannedStart } : {}),
          ...(opts.plannedEnd ? { plannedCompletion: opts.plannedEnd } : {}),
          ...(opts.estimatedMinutes != null ? { estimatedMinutes: opts.estimatedMinutes } : {}),
        },
        include: {
          assignedEmployee: { select: { id: true, firstName: true, lastName: true, email: true } },
          stageDefinition: true,
          productionOrder: { select: { id: true, number: true, releasedToFactoryAt: true } },
        },
      });
      if (updatedOnly.productionOrder?.releasedToFactoryAt) {
        await this.prisma.auditEvent
          ?.create?.({
            data: {
              userId: opts.actorUserId ?? null,
              action: 'production-task.change-assignment',
              entityType: 'ProductionTask',
              entityId: opts.task.id,
              newValues: {
                productionOrderId: updatedOnly.productionOrder.id,
                assignedEmployeeId: opts.employeeId,
                plannedStart: opts.plannedStart?.toISOString() ?? null,
                plannedCompletion: opts.plannedEnd?.toISOString() ?? null,
              } as Prisma.InputJsonValue,
            },
          })
          .catch(() => undefined);
      }
      return { task: updatedOnly, allocationId, scheduleId, issues: [] };
    }

    const updated = await this.prisma.productionTask.findUniqueOrThrow({
      where: { id: opts.task.id },
      include: {
        assignedEmployee: { select: { id: true, firstName: true, lastName: true, email: true } },
        stageDefinition: true,
        productionOrder: { select: { id: true, number: true, releasedToFactoryAt: true } },
      },
    });

    if (updated.productionOrder?.releasedToFactoryAt) {
      await this.prisma.auditEvent
        ?.create?.({
          data: {
            userId: opts.actorUserId ?? null,
            action: 'production-task.change-assignment',
            entityType: 'ProductionTask',
            entityId: opts.task.id,
            newValues: {
              productionOrderId: updated.productionOrder.id,
              assignedEmployeeId: opts.employeeId,
              plannedStart: opts.plannedStart?.toISOString() ?? null,
              plannedCompletion: opts.plannedEnd?.toISOString() ?? null,
            } as Prisma.InputJsonValue,
          },
        })
        .catch(() => undefined);
    }

    return { task: updated, allocationId, scheduleId, issues: [] };
  }

  /**
   * Persist an execution-ripple batch in one transaction. Remainder windows may
   * land on IN_PROGRESS tasks; downstream moves stay NOT_STARTED.
   */
  async persistExecutionRipple(opts: {
    batchId: string;
    actorUserId: string;
    reason: string;
    mode: string;
    moves: Array<{
      allocationId: string;
      taskId: string;
      productionOrderId: string;
      plannedStart: Date;
      plannedEnd: Date;
      oldStart: Date;
      oldEnd: Date;
      employeeId: string | null;
      estimatedMinutes: number;
    }>;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const move of opts.moves) {
        const minutes = Math.max(
          1,
          move.estimatedMinutes ||
            Math.round((move.plannedEnd.getTime() - move.plannedStart.getTime()) / 60_000),
        );
        await tx.scheduleAllocation.update({
          where: { id: move.allocationId },
          data: {
            plannedStart: move.plannedStart,
            plannedEnd: move.plannedEnd,
            estimatedMinutes: minutes,
            manuallyAdjusted: true,
            attentionCode: null,
          },
        });
        await tx.productionTask.update({
          where: { id: move.taskId },
          data: {
            plannedStart: move.plannedStart,
            plannedCompletion: move.plannedEnd,
          },
        });
        await tx.scheduleChangeHistory.create({
          data: {
            productionOrderId: move.productionOrderId,
            allocationId: move.allocationId,
            kind: 'execution-ripple',
            oldStart: move.oldStart,
            newStart: move.plannedStart,
            oldEnd: move.oldEnd,
            newEnd: move.plannedEnd,
            actorId: opts.actorUserId,
            reason: opts.reason,
            payload: {
              rippleBatchId: opts.batchId,
              mode: opts.mode,
              taskId: move.taskId,
            } as Prisma.InputJsonValue,
          },
        });
      }
    });
  }

  async revertExecutionRipple(opts: {
    batchId: string;
    actorUserId: string;
    rows: Array<{
      allocationId: string;
      productionOrderId: string | null;
      oldStart: Date | null;
      oldEnd: Date | null;
      newStart: Date | null;
      newEnd: Date | null;
    }>;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const row of opts.rows) {
        if (!row.oldStart || !row.oldEnd) continue;
        await tx.scheduleAllocation.update({
          where: { id: row.allocationId },
          data: {
            plannedStart: row.oldStart,
            plannedEnd: row.oldEnd,
            manuallyAdjusted: true,
            attentionCode: null,
          },
        });
        const alloc = await tx.scheduleAllocation.findUnique({
          where: { id: row.allocationId },
          select: { productionTaskId: true },
        });
        if (alloc?.productionTaskId) {
          await tx.productionTask.update({
            where: { id: alloc.productionTaskId },
            data: {
              plannedStart: row.oldStart,
              plannedCompletion: row.oldEnd,
            },
          });
        }
        await tx.scheduleChangeHistory.create({
          data: {
            productionOrderId: row.productionOrderId,
            allocationId: row.allocationId,
            kind: 'execution-ripple-revert',
            oldStart: row.newStart,
            newStart: row.oldStart,
            oldEnd: row.newEnd,
            newEnd: row.oldEnd,
            actorId: opts.actorUserId,
            reason: `revert ${opts.batchId}`,
            payload: { rippleBatchId: opts.batchId, reverted: true } as Prisma.InputJsonValue,
          },
        });
      }
    });
  }

  private async notifyPlacementChange(input: {
    task: {
      id: string;
      name?: string | null;
      assignedEmployeeId: string | null;
      stageDefinition?: { nameEn?: string | null } | null;
      productionOrder?: { number?: string | null; salesOrder?: { number?: string | null } | null } | null;
    };
    nextEmployeeId: string | null;
    plannedStart: Date | null;
    actorUserId: string | null;
  }) {
    const number =
      input.task.productionOrder?.salesOrder?.number ?? input.task.productionOrder?.number ?? '';
    const taskName = input.task.name ?? input.task.stageDefinition?.nameEn ?? 'Task';
    if (
      this.floorHandoff &&
      input.nextEmployeeId &&
      input.nextEmployeeId !== input.task.assignedEmployeeId
    ) {
      await this.floorHandoff
        .onTaskAssigned({
          taskId: input.task.id,
          employeeId: input.nextEmployeeId,
          taskName,
          number,
          actorUserId: input.actorUserId,
        })
        .catch(() => undefined);
    }
    if (this.opsNotify && input.nextEmployeeId && input.plannedStart) {
      const calendar = await this.loadWorkingCalendar();
      const tz = calendar?.timezone || DEFAULT_FACTORY_TIMEZONE;
      const todayYmd = ymdInTimezone(new Date(), tz);
      if (ymdInTimezone(input.plannedStart, tz) === todayYmd) {
        await this.opsNotify
          .onTaskScheduledToday({
            taskId: input.task.id,
            taskName,
            number,
            employeeId: input.nextEmployeeId,
            dayYmd: todayYmd,
          })
          .catch(() => undefined);
      }
    }
  }
}
