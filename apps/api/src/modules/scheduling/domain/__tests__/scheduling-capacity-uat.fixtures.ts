/**
 * Isolated in-memory fixtures for scheduling capacity UAT.
 * Does not touch Prisma, seed, or production data.
 */
import { WorkingCalendar, zonedLocalToUtc } from '../working-calendar';
import { backwardSchedule, forwardSchedule, resourceCapacityKey } from '../schedule-planner';
import type {
  OccupancyInterval,
  PlannedAllocation,
  PlannerOrderInput,
  PlannerStageInput,
  Priority,
  WorkerCandidate,
} from '../types';
import type { PlannerContext } from '../schedule-planner';

export const TZ = 'Asia/Amman';
export const STG = {
  carpentry: 'stg-carpentry',
  foam: 'stg-foam',
  painting: 'stg-painting',
  upholstery: 'stg-upholstery',
  assembly: 'stg-assembly',
  other: 'stg-other',
} as const;

export function amman(y: number, m: number, d: number, hh = 8, mm = 0): Date {
  return zonedLocalToUtc(y, m, d, hh, mm, 0, TZ);
}

/** 08:00–16:00, no lunch → 8 working hours. Sun–Thu open (matches Jordan Fri-closed factory week). */
export function eightHourCalendar(
  overrides: Partial<ConstructorParameters<typeof WorkingCalendar>[0]> = {},
): WorkingCalendar {
  return new WorkingCalendar({
    timezone: TZ,
    workingWeekdays: [0, 1, 2, 3, 4],
    shiftStart: '08:00',
    shiftEnd: '16:00',
    breaks: [],
    exceptions: [],
    ...overrides,
  });
}

/** Factory default: 08:00–16:00 with lunch → 7 working hours. Sat open, Fri closed. */
export function sevenHourCalendar(
  overrides: Partial<ConstructorParameters<typeof WorkingCalendar>[0]> = {},
): WorkingCalendar {
  return new WorkingCalendar({
    timezone: TZ,
    workingWeekdays: [0, 1, 2, 3, 4, 6],
    shiftStart: '08:00',
    shiftEnd: '16:00',
    breaks: [{ start: '12:00', end: '13:00' }],
    exceptions: [],
    ...overrides,
  });
}

export const NOW = amman(2026, 8, 9, 8, 0); // Sunday

export function worker(
  id: string,
  skills: string[],
  opts?: { isActive?: boolean; departmentCode?: string | null },
): WorkerCandidate {
  return {
    id,
    isActive: opts?.isActive ?? true,
    departmentCode: opts?.departmentCode ?? 'CARPENTRY',
    skillStageDefinitionIds: skills,
  };
}

export function stage(
  code: string,
  stageDefinitionId: string,
  estimatedMinutes: number,
  dependsOnCodes: string[] = [],
): PlannerStageInput {
  return {
    code,
    stageDefinitionId,
    dependsOnCodes,
    estimatedMinutes,
    departmentCode: 'CARPENTRY',
  };
}

export function carpentryOnly(minutes = 240): PlannerStageInput[] {
  return [stage('CARPENTRY', STG.carpentry, minutes)];
}

export function order(
  partial: Partial<PlannerOrderInput> & Pick<PlannerOrderInput, 'id'>,
): PlannerOrderInput {
  return {
    customerId: 'cust-a',
    priority: 'NORMAL',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    stages: carpentryOnly(),
    bufferMinutes: 0,
    ...partial,
  };
}

export function ctx(
  workers: WorkerCandidate[],
  extras: Partial<PlannerContext> = {},
): PlannerContext {
  return {
    calendar: eightHourCalendar(),
    workers,
    now: NOW,
    existingOccupancy: [],
    ...extras,
  };
}

export function occupancy(
  employeeId: string,
  start: Date,
  end: Date,
  allocationId: string,
): OccupancyInterval {
  return { employeeId, start, end, allocationId };
}

export function localYmd(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

export function localHour(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  });
  return Number(fmt.format(date));
}

export function overlaps(a: PlannedAllocation, b: PlannedAllocation): boolean {
  return a.plannedStart.getTime() < b.plannedEnd.getTime() && b.plannedStart.getTime() < a.plannedEnd.getTime();
}

export function assertNoWorkerOverlap(allocations: PlannedAllocation[]): void {
  const booked = allocations.filter((a) => a.employeeId);
  for (let i = 0; i < booked.length; i++) {
    for (let j = i + 1; j < booked.length; j++) {
      const a = booked[i]!;
      const b = booked[j]!;
      if (a.employeeId !== b.employeeId) continue;
      if (overlaps(a, b)) {
        throw new Error(
          `Worker ${a.employeeId} double-booked: ${a.orderId}:${a.stageCode} ${a.plannedStart.toISOString()}–${a.plannedEnd.toISOString()} vs ${b.orderId}:${b.stageCode} ${b.plannedStart.toISOString()}–${b.plannedEnd.toISOString()}`,
        );
      }
    }
  }
}

export function employeeIds(allocations: PlannedAllocation[]): string[] {
  return [...new Set(allocations.map((a) => a.employeeId).filter((id): id is string => Boolean(id)))].sort();
}

export function tasksStartingOn(allocations: PlannedAllocation[], ymd: string): PlannedAllocation[] {
  return allocations.filter((a) => localYmd(a.plannedStart) === ymd);
}

export function maxEnd(allocations: PlannedAllocation[]): Date {
  return allocations.reduce(
    (max, a) => (a.plannedEnd.getTime() > max.getTime() ? a.plannedEnd : max),
    allocations[0]!.plannedEnd,
  );
}

export function minStart(allocations: PlannedAllocation[]): Date {
  return allocations.reduce(
    (min, a) => (a.plannedStart.getTime() < min.getTime() ? a.plannedStart : min),
    allocations[0]!.plannedStart,
  );
}

/** Simulate generateForProductionOrder: one order at a time against accumulating occupancy. */
export function sequentialPlan(
  orders: PlannerOrderInput[],
  base: PlannerContext,
  mode: 'forward' | 'backward' | 'auto' = 'auto',
): { allocations: PlannedAllocation[]; results: ReturnType<typeof forwardSchedule>[] } {
  const occupancyAcc: OccupancyInterval[] = [...(base.existingOccupancy ?? [])];
  const allocations: PlannedAllocation[] = [];
  const results: ReturnType<typeof forwardSchedule>[] = [];

  for (const o of orders) {
    const useBackward =
      mode === 'backward' || (mode === 'auto' && Boolean(o.requestedDeliveryDate));
    const planCtx = { ...base, existingOccupancy: occupancyAcc };
    const result = useBackward ? backwardSchedule([o], planCtx) : forwardSchedule([o], planCtx);
    results.push(result);
    for (const a of result.allocations) {
      allocations.push(a);
      const capId =
        a.employeeId ??
        (a.resourceSlot != null ? resourceCapacityKey(a.stageDefinitionId, a.resourceSlot) : null);
      if (capId) {
        occupancyAcc.push({
          employeeId: capId,
          start: a.plannedStart,
          end: a.plannedEnd,
          allocationId: `${a.orderId}:${a.stageCode}`,
        });
      }
    }
  }

  return { allocations, results };
}

export function nOrders(
  count: number,
  opts?: {
    customerId?: string;
    prefix?: string;
    stages?: PlannerStageInput[];
    requestedDeliveryDate?: Date;
    priority?: Priority;
    createdAt?: Date;
  },
): PlannerOrderInput[] {
  const prefix = opts?.prefix ?? 'o';
  return Array.from({ length: count }, (_, i) =>
    order({
      id: `${prefix}${i + 1}`,
      customerId: opts?.customerId ?? 'cust-a',
      stages: opts?.stages ?? carpentryOnly(),
      requestedDeliveryDate: opts?.requestedDeliveryDate,
      priority: opts?.priority,
      createdAt: opts?.createdAt
        ? new Date(opts.createdAt.getTime() + i * 1000)
        : new Date(`2026-08-01T00:00:${String(i).padStart(2, '0')}.000Z`),
    }),
  );
}

export const forkMergeStages: PlannerStageInput[] = [
  stage('CARPENTRY', STG.carpentry, 120),
  stage('FOAM', STG.foam, 180, ['CARPENTRY']),
  stage('PAINTING', STG.painting, 180, ['CARPENTRY']),
  stage('UPHOLSTERY', STG.upholstery, 120, ['FOAM', 'PAINTING']),
];

export const linearCua: PlannerStageInput[] = [
  stage('CARPENTRY', STG.carpentry, 240),
  stage('UPHOLSTERY', STG.upholstery, 360, ['CARPENTRY']),
  stage('ASSEMBLY', STG.assembly, 120, ['UPHOLSTERY']),
];
