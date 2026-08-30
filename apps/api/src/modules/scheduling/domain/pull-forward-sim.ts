/**
 * In-memory pull-forward simulation. Reuses WorkingCalendar, CapacityTracker,
 * forwardSchedule, material/WIP helpers, and factory urgency ordering.
 * Does not persist allocations or invent SKU→stage maps.
 */
import { classifyScheduleRisk, type CanonicalScheduleStatus } from './at-risk';
import {
  compareFactoryReplanCandidates,
  occupancyFromGeneratedAllocations,
  ymdInTimezone,
  type FactoryReplanUrgency,
} from './factory-replan';
import {
  applyStageOrOrderMaterialFloors,
  assessMaterialReadiness,
  type FrozenStageMaterialInput,
} from './material-readiness';
import { comparePriority } from './priority-fairness';
import { forwardSchedule, type PlannerContext } from './schedule-planner';
import type {
  InventoryAvailability,
  OccupancyInterval,
  PlannedAllocation,
  PlannerOrderInput,
  PlannerStageInput,
  Priority,
  PrioritySortItem,
  WorkerCandidate,
} from './types';
import {
  applyConsumeWipDependencies,
  type WipLot,
  type WipSnapshotNode,
} from './wip-readiness';
import {
  addDaysYmd,
  overlapWorkingMinutes,
  type WorkingCalendar,
} from './working-calendar';

export type PullForwardBlockReason =
  | 'MOVABLE_EARLIER'
  | 'NOT_READY_MATERIAL'
  | 'NOT_READY_WIP'
  | 'DEPENDENCY_BLOCKED'
  | 'NO_WORKER_CAPACITY'
  | 'NO_RESOURCE_CAPACITY'
  | 'PINNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DELIVERY_POLICY'
  | 'SCARCE_MATERIAL_HELD_FOR_HIGHER_PRIORITY'
  | 'OTHER';

export type EmptyDayCause =
  | 'NO_ORDERS'
  | 'CAPACITY_POLICY'
  | 'MATERIAL_SHORTAGE'
  | 'MATERIAL_ETA'
  | 'WIP'
  | 'WORKER_BOTTLENECK'
  | 'RESOURCE_BOTTLENECK'
  | 'CLOSED'
  | 'OTHER';

export type SimCurrentAllocation = {
  stageCode: string;
  stageDefinitionId: string;
  plannedStart: Date;
  plannedEnd: Date;
  employeeId: string | null;
  resourceSlot?: number | null;
  isPinned: boolean;
  manuallyAdjusted?: boolean;
  taskStatus?: string | null;
  estimatedMinutes: number;
};

export type SimOrderInput = {
  id: string;
  number?: string;
  customerId: string;
  priority: Priority;
  committedDeliveryDate?: Date | null;
  requestedDeliveryDate?: Date | null;
  latestCompletionTarget?: Date | null;
  createdAt: Date;
  primaryStatus?: CanonicalScheduleStatus;
  required: Record<string, number>;
  consumingStageCodes: string[];
  stageMaterialInputs?: FrozenStageMaterialInput[];
  creditOwnReservation: boolean;
  wipNodes: WipSnapshotNode[];
  wipLots: WipLot[];
  orderQty: number;
  stages: PlannerStageInput[];
  currentAllocations: SimCurrentAllocation[];
  bufferMinutes?: number;
};

export type StageCapacityMeta = {
  stageDefinitionId: string;
  code: string;
  schedulingResourceMode?: string | null;
  resourceSlots?: number | null;
  skilledWorkerCount: number;
};

export type SimWorld = {
  calendar: WorkingCalendar;
  workers: WorkerCandidate[];
  now: Date;
  inventory: Record<string, InventoryAvailability>;
  orders: SimOrderInput[];
  stages: StageCapacityMeta[];
};

export type PolicyKind = 'CURRENT' | 'EARLIEST' | 'N_DAY';

export type OrderSimResult = {
  orderId: string;
  number?: string;
  placed: boolean;
  blockReason: PullForwardBlockReason | null;
  materialReadyAt: Date | null;
  materialReady: boolean;
  materialRisk: boolean;
  scarceHeld: boolean;
  earliestCompletion: Date | null;
  currentCompletion: Date | null;
  allocations: PlannedAllocation[];
  skippedStages: Array<{ code: string; reason: PullForwardBlockReason }>;
  stageReadyAt?: Record<string, Date | null>;
  usedStageMaps?: boolean;
};

export type DayLoad = {
  ymd: string;
  open: boolean;
  overtime: boolean;
  shiftMinutes: number;
  occupancyAvailableMinutes: number;
  occupancyAllocatedMinutes: number;
  occupancyUtilPct: number;
  stageBucketAvailableMinutes: number;
  stageBucketAllocatedMinutes: number;
  stageBucketUtilPct: number;
  allocationCount: number;
  distinctOrders: number;
  stageBreakdown: Array<{
    code: string;
    allocatedMinutes: number;
    availableMinutes: number;
    utilPct: number;
  }>;
  bucket: 'EMPTY' | 'LT_25' | 'MID' | 'GT_60';
  cause: EmptyDayCause | null;
};

export type PolicyMetrics = {
  policy: PolicyKind;
  nWorkingDays?: number;
  avgOccupancyUtilPct: number;
  emptyDays: number;
  daysLt25: number;
  daysGt85: number;
  ordersFinishedEarlier: number;
  meanDaysEarly: number;
  maxDaysEarly: number;
  materialViolations: number;
  wipUnknown: number;
  placedOrders: number;
  blockedOrders: number;
  movedOrderCount: number;
  occupancyUtilAtTargets: Record<string, number>;
  days: DayLoad[];
  orders: OrderSimResult[];
  allocations: PlannedAllocation[];
};

const IMMUTABLE_TASK = new Set(['COMPLETED', 'IN_PROGRESS']);

function later(a?: Date | null, b?: Date | null): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

export function cloneInventory(
  inventory: Record<string, InventoryAvailability>,
): Record<string, InventoryAvailability> {
  const out: Record<string, InventoryAvailability> = {};
  for (const [key, row] of Object.entries(inventory)) {
    out[key] = {
      available: row.available,
      reserved: row.reserved,
      readyAt: row.readyAt ? new Date(row.readyAt.getTime()) : row.readyAt,
      incoming: (row.incoming ?? []).map((lot) => ({
        qty: lot.qty,
        readyAt: new Date(lot.readyAt.getTime()),
      })),
    };
  }
  return out;
}

/** Same credit rule as generate: only if reserved pool covers this order's need. */
export function creditOwnReservation(
  inventory: Record<string, InventoryAvailability>,
  required: Record<string, number>,
): Record<string, InventoryAvailability> {
  const next = cloneInventory(inventory);
  for (const [key, qty] of Object.entries(required)) {
    if (!(qty > 0)) continue;
    const row = next[key] ?? { available: 0, reserved: 0, incoming: [] };
    if ((row.reserved ?? 0) + 1e-9 < qty) continue;
    next[key] = { ...row, available: (row.available ?? 0) + qty };
  }
  return next;
}

export function consumeUnreservedDemand(
  inventory: Record<string, InventoryAvailability>,
  required: Record<string, number>,
  creditOwn: boolean,
): void {
  if (creditOwn) return;
  for (const [key, qty] of Object.entries(required)) {
    if (!(qty > 0)) continue;
    const row = inventory[key] ?? { available: 0, reserved: 0, incoming: [] };
    const take = Math.min(row.available ?? 0, qty);
    inventory[key] = {
      ...row,
      available: (row.available ?? 0) - take,
      reserved: (row.reserved ?? 0) + take,
    };
  }
}

export function nextWorkingYmds(
  calendar: WorkingCalendar,
  fromYmd: string,
  count: number,
): string[] {
  const out: string[] = [];
  let ymd = fromYmd;
  for (let guard = 0; guard < 400 && out.length < count; guard += 1) {
    if (calendar.intervalsForLocalYmd(ymd).length > 0) out.push(ymd);
    ymd = addDaysYmd(ymd, 1);
  }
  return out;
}

export function workingDayStartNDaysBefore(
  calendar: WorkingCalendar,
  target: Date,
  workingDays: number,
): Date {
  let ymd = ymdInTimezone(target, calendar.timezone);
  let left = Math.max(0, Math.floor(workingDays));
  while (left > 0) {
    ymd = addDaysYmd(ymd, -1);
    if (calendar.intervalsForLocalYmd(ymd).length > 0) left -= 1;
  }
  const iv = calendar.intervalsForLocalYmd(ymd);
  return iv[0]?.start ?? target;
}

function isImmutableAlloc(alloc: SimCurrentAllocation): boolean {
  return (
    IMMUTABLE_TASK.has(String(alloc.taskStatus ?? '')) ||
    alloc.isPinned ||
    Boolean(alloc.manuallyAdjusted)
  );
}

export function lockImmutableStages(order: SimOrderInput): PlannerStageInput[] {
  const byCode = new Map(order.currentAllocations.map((a) => [a.stageCode, a]));
  return order.stages.map((stage) => {
    const alloc = byCode.get(stage.code);
    if (!alloc || !isImmutableAlloc(alloc)) return { ...stage };
    return {
      ...stage,
      isPinned: true,
      pinnedStart: alloc.plannedStart,
      pinnedEnd: alloc.plannedEnd,
      preferredEmployeeId: alloc.employeeId ?? stage.preferredEmployeeId,
    };
  });
}

export function pullForwardUrgency(
  order: SimOrderInput,
): FactoryReplanUrgency | 'committed' | 'high' | 'requested' | 'ready' {
  if (order.primaryStatus === 'LATE' && order.committedDeliveryDate) return 'late';
  if (order.primaryStatus === 'AT_RISK' && order.committedDeliveryDate) return 'atRisk';
  if (order.committedDeliveryDate) return 'committed';
  if (order.priority === 'HIGH' || order.priority === 'URGENT') return 'high';
  if (order.requestedDeliveryDate) return 'requested';
  return 'ready';
}

const PULL_RANK: Record<string, number> = {
  late: 0,
  atRisk: 1,
  committed: 2,
  high: 3,
  requested: 4,
  ready: 5,
  forward: 6,
};

export function sortPullForwardOrders(orders: SimOrderInput[]): SimOrderInput[] {
  return [...orders].sort((a, b) => {
    const ur = (PULL_RANK[pullForwardUrgency(a)] ?? 9) - (PULL_RANK[pullForwardUrgency(b)] ?? 9);
    if (ur !== 0) return ur;
    const pa: PrioritySortItem = {
      id: a.id,
      customerId: a.customerId,
      isPinned: a.currentAllocations.some((x) => x.isPinned),
      priority: a.priority,
      committedDeliveryDate: a.committedDeliveryDate,
      requestedDeliveryDate: a.requestedDeliveryDate,
      createdAt: a.createdAt,
    };
    const pb: PrioritySortItem = {
      id: b.id,
      customerId: b.customerId,
      isPinned: b.currentAllocations.some((x) => x.isPinned),
      priority: b.priority,
      committedDeliveryDate: b.committedDeliveryDate,
      requestedDeliveryDate: b.requestedDeliveryDate,
      createdAt: b.createdAt,
    };
    const fakeA = {
      productionOrderId: a.id,
      number: a.number ?? a.id,
      urgency: (pullForwardUrgency(a) === 'late'
        ? 'late'
        : pullForwardUrgency(a) === 'atRisk'
          ? 'atRisk'
          : 'forward') as FactoryReplanUrgency,
      priority: pa,
    };
    const fakeB = {
      productionOrderId: b.id,
      number: b.number ?? b.id,
      urgency: (pullForwardUrgency(b) === 'late'
        ? 'late'
        : pullForwardUrgency(b) === 'atRisk'
          ? 'atRisk'
          : 'forward') as FactoryReplanUrgency,
      priority: pb,
    };
    const factory = compareFactoryReplanCandidates(fakeA, fakeB);
    if (factory !== 0) return factory;
    return comparePriority(pa, pb);
  });
}

function currentCompletion(order: SimOrderInput): Date | null {
  if (!order.currentAllocations.length) return null;
  return order.currentAllocations.reduce(
    (max, a) => (a.plannedEnd.getTime() > max.getTime() ? a.plannedEnd : max),
    order.currentAllocations[0]!.plannedEnd,
  );
}

function classifyPlaceError(message: string): PullForwardBlockReason {
  if (message.includes('NO_ELIGIBLE_WORKER')) return 'NO_WORKER_CAPACITY';
  if (message.includes('NO_RESOURCE_CAPACITY')) return 'NO_RESOURCE_CAPACITY';
  if (message.includes('NO_SLOT')) return 'NO_RESOURCE_CAPACITY';
  if (message.includes('Parents not ready')) return 'DEPENDENCY_BLOCKED';
  return 'OTHER';
}

export function applyNDayFloor(
  stages: PlannerStageInput[],
  calendar: WorkingCalendar,
  target: Date | null | undefined,
  nWorkingDays: number | undefined,
  schedulingFloor?: Date,
): PlannerStageInput[] {
  if (!nWorkingDays || !target) return stages;
  const nDay = workingDayStartNDaysBefore(calendar, target, nWorkingDays);
  const floor = schedulingFloor ? later(nDay, schedulingFloor) : nDay;
  return stages.map((stage) =>
    stage.isPinned ? stage : { ...stage, notBefore: later(stage.notBefore, floor) },
  );
}

export function prepareOrderForForward(
  order: SimOrderInput,
  inventory: Record<string, InventoryAvailability>,
  calendar: WorkingCalendar,
  nWorkingDays?: number,
  schedulingFloor?: Date,
): {
  input: PlannerOrderInput;
  materialReady: boolean;
  materialReadyAt: Date | null;
  materialRisk: boolean;
  scarceHeld: boolean;
  blockReason: PullForwardBlockReason | null;
  skippedStages: Array<{ code: string; reason: PullForwardBlockReason }>;
  stageReadyAt: Record<string, Date | null>;
  usedStageMaps: boolean;
} {
  const skippedStages: Array<{ code: string; reason: PullForwardBlockReason }> = [];
  const locked = lockImmutableStages(order);
  for (const stage of locked) {
    const alloc = order.currentAllocations.find((a) => a.stageCode === stage.code);
    if (!alloc) continue;
    if (alloc.taskStatus === 'COMPLETED') skippedStages.push({ code: stage.code, reason: 'COMPLETED' });
    else if (alloc.taskStatus === 'IN_PROGRESS') skippedStages.push({ code: stage.code, reason: 'IN_PROGRESS' });
    else if (alloc.isPinned || alloc.manuallyAdjusted) skippedStages.push({ code: stage.code, reason: 'PINNED' });
  }

  const view = order.creditOwnReservation
    ? creditOwnReservation(inventory, order.required)
    : inventory;
  const readiness = assessMaterialReadiness(order.required, view);
  const unconstrained = assessMaterialReadiness(order.required, {
    ...Object.fromEntries(
      Object.entries(inventory).map(([key, row]) => [
        key,
        { ...row, available: (row.available ?? 0) + (row.reserved ?? 0) },
      ]),
    ),
  });
  const scarceHeld =
    !readiness.ready &&
    unconstrained.ready &&
    !order.creditOwnReservation;

  if (!readiness.ready && !readiness.materialReadyAt) {
    return {
      input: {
        id: order.id,
        customerId: order.customerId,
        priority: order.priority,
        committedDeliveryDate: order.committedDeliveryDate,
        requestedDeliveryDate: order.requestedDeliveryDate,
        latestCompletionTarget: order.latestCompletionTarget,
        createdAt: order.createdAt,
        stages: locked,
        bufferMinutes: order.bufferMinutes ?? 0,
      },
      materialReady: false,
      materialReadyAt: null,
      materialRisk: true,
      scarceHeld,
      blockReason: scarceHeld ? 'SCARCE_MATERIAL_HELD_FOR_HIGHER_PRIORITY' : 'NOT_READY_MATERIAL',
      skippedStages,
      stageReadyAt: {},
      usedStageMaps: false,
    };
  }

  const materialApplied = applyStageOrOrderMaterialFloors({
    stages: locked,
    frozenInputs: order.stageMaterialInputs ?? [],
    orderQty: order.orderQty,
    inventory: view,
    orderWideReadyAt: readiness.materialReadyAt,
    consumingStageCodes: order.consumingStageCodes,
  });
  if (materialApplied.unknownRequired) {
    return {
      input: {
        id: order.id,
        customerId: order.customerId,
        priority: order.priority,
        committedDeliveryDate: order.committedDeliveryDate,
        requestedDeliveryDate: order.requestedDeliveryDate,
        latestCompletionTarget: order.latestCompletionTarget,
        createdAt: order.createdAt,
        stages: locked,
        bufferMinutes: order.bufferMinutes ?? 0,
      },
      materialReady: false,
      materialReadyAt: null,
      materialRisk: true,
      scarceHeld,
      blockReason: 'NOT_READY_MATERIAL',
      skippedStages,
      stageReadyAt: materialApplied.stageReadyAt,
      usedStageMaps: materialApplied.usedStageMaps,
    };
  }
  let stages = materialApplied.stages;
  const wip = applyConsumeWipDependencies(stages, order.wipNodes, order.wipLots, order.orderQty);
  if (wip.unknownWip) {
    return {
      input: {
        id: order.id,
        customerId: order.customerId,
        priority: order.priority,
        createdAt: order.createdAt,
        stages: wip.stages,
      },
      materialReady: readiness.ready,
      materialReadyAt: readiness.materialReadyAt,
      materialRisk: readiness.risk,
      scarceHeld,
      blockReason: 'NOT_READY_WIP',
      skippedStages,
      stageReadyAt: materialApplied.stageReadyAt,
      usedStageMaps: materialApplied.usedStageMaps,
    };
  }
  stages = applyNDayFloor(
    wip.stages,
    calendar,
    order.latestCompletionTarget ?? order.committedDeliveryDate ?? order.requestedDeliveryDate,
    nWorkingDays,
    schedulingFloor,
  );

  return {
    input: {
      id: order.id,
      customerId: order.customerId,
      priority: order.priority,
      isPinned: order.currentAllocations.some((a) => a.isPinned),
      committedDeliveryDate: order.committedDeliveryDate,
      requestedDeliveryDate: order.requestedDeliveryDate,
      latestCompletionTarget: order.latestCompletionTarget,
      createdAt: order.createdAt,
      stages,
      bufferMinutes: order.bufferMinutes ?? 0,
      materialReadyAt: materialApplied.orderMaterialReadyAt,
    },
    materialReady: readiness.ready,
    materialReadyAt: readiness.materialReadyAt,
    materialRisk: readiness.risk,
    scarceHeld,
    blockReason: null,
    skippedStages,
    stageReadyAt: materialApplied.stageReadyAt,
    usedStageMaps: materialApplied.usedStageMaps,
  };
}

function currentAsPlanned(order: SimOrderInput): PlannedAllocation[] {
  return order.currentAllocations.map((a) => ({
    orderId: order.id,
    stageCode: a.stageCode,
    stageDefinitionId: a.stageDefinitionId,
    resourceType: a.employeeId ? 'EMPLOYEE' : 'DEPARTMENT',
    employeeId: a.employeeId,
    departmentCode: null,
    plannedStart: a.plannedStart,
    plannedEnd: a.plannedEnd,
    estimatedMinutes: a.estimatedMinutes,
    isPinned: a.isPinned,
    resourceSlot: a.resourceSlot ?? null,
  }));
}

export function simulatePolicy(
  world: SimWorld,
  policy: PolicyKind,
  nWorkingDays?: number,
): PolicyMetrics {
  if (policy === 'CURRENT') {
    const orders: OrderSimResult[] = world.orders.map((order) => ({
      orderId: order.id,
      number: order.number,
      placed: order.currentAllocations.length > 0,
      blockReason: null,
      materialReadyAt: null,
      materialReady: true,
      materialRisk: false,
      scarceHeld: false,
      earliestCompletion: currentCompletion(order),
      currentCompletion: currentCompletion(order),
      allocations: currentAsPlanned(order),
      skippedStages: [],
    }));
    const allocations = orders.flatMap((o) => o.allocations);
    return metricsFrom(world, policy, nWorkingDays, orders, allocations);
  }

  const inventory = cloneInventory(world.inventory);
  let occupancy: OccupancyInterval[] = [];
  const sorted = sortPullForwardOrders(world.orders);
  const results: OrderSimResult[] = [];

  for (const order of sorted) {
    const prepared = prepareOrderForForward(
      order,
      inventory,
      world.calendar,
      policy === 'N_DAY' ? nWorkingDays : undefined,
      world.now,
    );
    if (prepared.blockReason) {
      results.push({
        orderId: order.id,
        number: order.number,
        placed: false,
        blockReason: prepared.blockReason,
        materialReadyAt: prepared.materialReadyAt,
        materialReady: prepared.materialReady,
        materialRisk: prepared.materialRisk,
        scarceHeld: prepared.scarceHeld,
        earliestCompletion: currentCompletion(order),
        currentCompletion: currentCompletion(order),
        allocations: currentAsPlanned(order).filter((a) =>
          prepared.skippedStages.some((s) => s.code === a.stageCode),
        ),
        skippedStages: prepared.skippedStages,
        stageReadyAt: prepared.stageReadyAt,
        usedStageMaps: prepared.usedStageMaps,
      });
      const lockedOcc = occupancyFromGeneratedAllocations(
        order.id,
        order.currentAllocations.filter(isImmutableAlloc).map((a) => ({
          employeeId: a.employeeId,
          resourceSlot: a.resourceSlot,
          stageDefinitionId: a.stageDefinitionId,
          plannedStart: a.plannedStart,
          plannedEnd: a.plannedEnd,
        })),
      );
      occupancy = [...occupancy, ...lockedOcc];
      continue;
    }

    const ctx: PlannerContext = {
      calendar: world.calendar,
      workers: world.workers,
      existingOccupancy: occupancy,
      now: world.now,
    };
    try {
      const planned = forwardSchedule([prepared.input], ctx);
      occupancy = [
        ...occupancy,
        ...occupancyFromGeneratedAllocations(order.id, planned.allocations),
      ];
      consumeUnreservedDemand(inventory, order.required, order.creditOwnReservation);
      results.push({
        orderId: order.id,
        number: order.number,
        placed: true,
        blockReason: prepared.scarceHeld ? 'SCARCE_MATERIAL_HELD_FOR_HIGHER_PRIORITY' : null,
        materialReadyAt: prepared.materialReadyAt,
        materialReady: prepared.materialReady,
        materialRisk: prepared.materialRisk,
        scarceHeld: prepared.scarceHeld,
        earliestCompletion: planned.earliestCompletion,
        currentCompletion: currentCompletion(order),
        allocations: planned.allocations,
        skippedStages: prepared.skippedStages,
        stageReadyAt: prepared.stageReadyAt,
        usedStageMaps: prepared.usedStageMaps,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        orderId: order.id,
        number: order.number,
        placed: false,
        blockReason: classifyPlaceError(message),
        materialReadyAt: prepared.materialReadyAt,
        materialReady: prepared.materialReady,
        materialRisk: prepared.materialRisk,
        scarceHeld: prepared.scarceHeld,
        earliestCompletion: currentCompletion(order),
        currentCompletion: currentCompletion(order),
        allocations: [],
        skippedStages: prepared.skippedStages,
      });
    }
  }

  const allocations = results.flatMap((o) => o.allocations);
  return metricsFrom(world, policy, nWorkingDays, results, allocations);
}

function daysBetweenLocal(calendar: WorkingCalendar, a: Date, b: Date): number {
  const ay = ymdInTimezone(a, calendar.timezone);
  const by = ymdInTimezone(b, calendar.timezone);
  if (ay === by) return 0;
  const dir = ay < by ? 1 : -1;
  let n = 0;
  let cursor = ay;
  while (cursor !== by && n < 400) {
    cursor = addDaysYmd(cursor, dir);
    n += 1;
  }
  return n * dir;
}

function metricsFrom(
  world: SimWorld,
  policy: PolicyKind,
  nWorkingDays: number | undefined,
  orders: OrderSimResult[],
  allocations: PlannedAllocation[],
): PolicyMetrics {
  const nowYmd = ymdInTimezone(world.now, world.calendar.timezone);
  const horizon = nextWorkingYmds(world.calendar, nowYmd, 30);
  const days = horizon.map((ymd) => dayLoad(world, ymd, allocations));

  const finishedEarlier = orders.filter((o) => {
    if (!o.placed || !o.earliestCompletion || !o.currentCompletion) return false;
    return o.earliestCompletion.getTime() + 60_000 < o.currentCompletion.getTime();
  });
  const earlyDays = finishedEarlier.map((o) =>
    Math.max(0, daysBetweenLocal(world.calendar, o.earliestCompletion!, o.currentCompletion!)),
  );
  const meanDaysEarly =
    earlyDays.length === 0 ? 0 : earlyDays.reduce((s, n) => s + n, 0) / earlyDays.length;
  const maxDaysEarly = earlyDays.length === 0 ? 0 : Math.max(...earlyDays);

  const utils = days.map((d) => d.occupancyUtilPct);
  const avgOccupancyUtilPct =
    utils.length === 0 ? 0 : utils.reduce((s, n) => s + n, 0) / utils.length;

  const occupancyUtilAtTargets: Record<string, number> = {};
  for (const t of [80, 85, 90, 95, 100]) {
    occupancyUtilAtTargets[String(t)] = days.filter((d) => d.occupancyUtilPct + 1e-9 >= t).length;
  }

  const materialViolations = allocations.filter((a) => {
    const order = world.orders.find((o) => o.id === a.orderId);
    if (!order) return false;
    const result = orders.find((o) => o.orderId === a.orderId);
    if (result?.usedStageMaps) {
      const stageReady = result.stageReadyAt?.[a.stageCode];
      if (!stageReady) return false;
      return a.plannedStart.getTime() + 1 < stageReady.getTime();
    }
    const readyAt = result?.materialReadyAt;
    if (!readyAt) return false;
    const consume = order.consumingStageCodes;
    const applies =
      consume.length === 0 || consume.includes(a.stageCode);
    if (!applies) return false;
    return a.plannedStart.getTime() + 1 < readyAt.getTime();
  }).length;

  return {
    policy,
    nWorkingDays,
    avgOccupancyUtilPct,
    emptyDays: days.filter((d) => d.bucket === 'EMPTY').length,
    daysLt25: days.filter((d) => d.bucket === 'EMPTY' || d.bucket === 'LT_25').length,
    daysGt85: days.filter((d) => d.occupancyUtilPct > 85).length,
    ordersFinishedEarlier: finishedEarlier.length,
    meanDaysEarly,
    maxDaysEarly,
    materialViolations,
    wipUnknown: orders.filter((o) => o.blockReason === 'NOT_READY_WIP').length,
    placedOrders: orders.filter((o) => o.placed).length,
    blockedOrders: orders.filter((o) => !o.placed).length,
    movedOrderCount: finishedEarlier.length,
    occupancyUtilAtTargets,
    days,
    orders,
    allocations,
  };
}

export function dayLoad(
  world: SimWorld,
  ymd: string,
  allocations: PlannedAllocation[],
): DayLoad {
  const intervals = world.calendar.intervalsForLocalYmd(ymd);
  const open = intervals.length > 0;
  const shiftMinutes = intervals.reduce(
    (s, iv) => s + (iv.end.getTime() - iv.start.getTime()) / 60_000,
    0,
  );
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: world.calendar.timezone,
    weekday: 'short',
  }).format(world.calendar.localInstant(ymd, 12, 0));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[weekdayName] ?? -1;
  const overtime = open && !world.calendar.workingWeekdays.has(weekday);

  const workerIds = world.workers.filter((w) => w.isActive).map((w) => w.id);
  const occupancyAvailableMinutes = Math.round(shiftMinutes * workerIds.length);
  let occupancyAllocatedMinutes = 0;
  for (const workerId of workerIds) {
    for (const a of allocations) {
      if (a.employeeId !== workerId) continue;
      occupancyAllocatedMinutes += overlapWorkingMinutes(a.plannedStart, a.plannedEnd, intervals);
    }
  }
  occupancyAllocatedMinutes = Math.round(occupancyAllocatedMinutes);

  const stageBreakdown = world.stages.map((stage) => {
    const heads =
      stage.schedulingResourceMode === 'RESOURCE_CONSTRAINED'
        ? Math.max(0, stage.resourceSlots ?? 0)
        : stage.skilledWorkerCount;
    const availableMinutes = Math.round(shiftMinutes * heads);
    const allocatedMinutes = Math.round(
      allocations
        .filter((a) => a.stageDefinitionId === stage.stageDefinitionId)
        .reduce((s, a) => s + overlapWorkingMinutes(a.plannedStart, a.plannedEnd, intervals), 0),
    );
    return {
      code: stage.code,
      allocatedMinutes,
      availableMinutes,
      utilPct: availableMinutes > 0 ? (allocatedMinutes / availableMinutes) * 100 : 0,
    };
  });
  const stageBucketAvailableMinutes = stageBreakdown.reduce((s, r) => s + r.availableMinutes, 0);
  const stageBucketAllocatedMinutes = stageBreakdown.reduce((s, r) => s + r.allocatedMinutes, 0);

  const onDay = allocations.filter(
    (a) => overlapWorkingMinutes(a.plannedStart, a.plannedEnd, intervals) > 0,
  );
  const occupancyUtilPct =
    occupancyAvailableMinutes > 0
      ? (occupancyAllocatedMinutes / occupancyAvailableMinutes) * 100
      : 0;
  const stageBucketUtilPct =
    stageBucketAvailableMinutes > 0
      ? (stageBucketAllocatedMinutes / stageBucketAvailableMinutes) * 100
      : 0;

  let bucket: DayLoad['bucket'] = 'MID';
  if (!open || occupancyAllocatedMinutes <= 0) bucket = 'EMPTY';
  else if (occupancyUtilPct < 25) bucket = 'LT_25';
  else if (occupancyUtilPct > 60) bucket = 'GT_60';

  return {
    ymd,
    open,
    overtime,
    shiftMinutes,
    occupancyAvailableMinutes,
    occupancyAllocatedMinutes,
    occupancyUtilPct,
    stageBucketAvailableMinutes,
    stageBucketAllocatedMinutes,
    stageBucketUtilPct,
    allocationCount: onDay.length,
    distinctOrders: new Set(onDay.map((a) => a.orderId)).size,
    stageBreakdown,
    bucket,
    cause: null,
  };
}

export function classifyEmptyDay(args: {
  current: DayLoad;
  earliest?: DayLoad;
  orderResults: OrderSimResult[];
  world: SimWorld;
}): EmptyDayCause {
  const { current, earliest, orderResults, world } = args;
  if (!current.open) return 'CLOSED';
  if (current.bucket !== 'EMPTY' && current.bucket !== 'LT_25') return 'OTHER';

  if (earliest && earliest.occupancyAllocatedMinutes > current.occupancyAllocatedMinutes + 1) {
    return 'CAPACITY_POLICY';
  }

  const ymdStart = world.calendar.intervalsForLocalYmd(current.ymd)[0]?.start;
  const materialEta = orderResults.some(
    (o) =>
      o.materialReadyAt &&
      ymdStart &&
      o.materialReadyAt.getTime() > ymdStart.getTime() &&
      !o.materialReady,
  );
  const materialShortage = orderResults.some(
    (o) => o.blockReason === 'NOT_READY_MATERIAL' && !o.materialReadyAt,
  );
  const scarce = orderResults.some(
    (o) => o.blockReason === 'SCARCE_MATERIAL_HELD_FOR_HIGHER_PRIORITY',
  );
  const wip = orderResults.some((o) => o.blockReason === 'NOT_READY_WIP');
  const worker = orderResults.some((o) => o.blockReason === 'NO_WORKER_CAPACITY');
  const resource = orderResults.some((o) => o.blockReason === 'NO_RESOURCE_CAPACITY');

  const remainingWork = world.orders.some((o) =>
    o.currentAllocations.some((a) => !isImmutableAlloc(a)),
  );

  if (materialShortage && !materialEta) return 'MATERIAL_SHORTAGE';
  if ((materialEta || scarce) && (!earliest || earliest.bucket === 'EMPTY')) return 'MATERIAL_ETA';
  if (wip) return 'WIP';
  if (worker) return 'WORKER_BOTTLENECK';
  if (resource) return 'RESOURCE_BOTTLENECK';
  if (!remainingWork && current.allocationCount === 0) return 'NO_ORDERS';
  if (!earliest || earliest.bucket === 'EMPTY') return 'NO_ORDERS';
  return remainingWork ? 'CAPACITY_POLICY' : 'NO_ORDERS';
}

export function attachEmptyDayCauses(
  current: PolicyMetrics,
  earliest: PolicyMetrics,
  world: SimWorld,
): PolicyMetrics {
  const byYmd = new Map(earliest.days.map((d) => [d.ymd, d]));
  return {
    ...current,
    days: current.days.map((d) => ({
      ...d,
      cause:
        d.bucket === 'EMPTY' || d.bucket === 'LT_25'
          ? classifyEmptyDay({
              current: d,
              earliest: byYmd.get(d.ymd),
              orderResults: earliest.orders,
              world,
            })
          : null,
    })),
  };
}

export function stageStartLegalForMaterials(args: {
  plannedStart: Date;
  stageCode: string;
  consumingStageCodes: string[];
  materialReadyAt: Date | null;
}): boolean {
  const { plannedStart, stageCode, consumingStageCodes, materialReadyAt } = args;
  if (!materialReadyAt) return true;
  const applies =
    consumingStageCodes.length === 0 || consumingStageCodes.includes(stageCode);
  if (!applies) return true;
  return plannedStart.getTime() + 1 >= materialReadyAt.getTime();
}

export function classifyLiveOrderStatus(input: {
  productionOrderStatus: string;
  scheduleStatus: string | null;
  committedDeliveryDate?: Date | null;
  requestedDeliveryDate?: Date | null;
  projectedCompletion?: Date | null;
  unschedulableReason?: string | null;
  materialRisk?: boolean;
  now: Date;
}): CanonicalScheduleStatus {
  return classifyScheduleRisk({
    productionOrderStatus: input.productionOrderStatus,
    scheduleStatus: input.scheduleStatus,
    committedDeliveryDate: input.committedDeliveryDate,
    requestedDeliveryDate: input.requestedDeliveryDate,
    projectedCompletion: input.projectedCompletion,
    unschedulableReason: input.unschedulableReason,
    materialRisk: input.materialRisk,
    now: input.now,
  }).primaryStatus;
}
