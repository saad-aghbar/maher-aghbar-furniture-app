import { CapacityTracker } from './capacity';
import {
  areParentsReady,
  buildDependencyGraph,
  mergeWaitInstant,
  topologicalLayers,
} from './dependency-graph';
import { sortWithFairness } from './priority-fairness';
import type {
  OccupancyInterval,
  PlannedAllocation,
  PlannerOrderInput,
  SchedulePlanResult,
  WorkerCandidate,
} from './types';
import { assignWorker, listEligibleWorkers } from './worker-assignment';
import type { WorkingCalendar } from './working-calendar';

export interface PlannerContext {
  calendar: WorkingCalendar;
  workers: WorkerCandidate[];
  existingOccupancy?: OccupancyInterval[];
  now: Date;
  /** Search horizon for fitting slots (default 2 years from now). */
  horizon?: Date;
}

function maxDate(dates: Array<Date | null | undefined>): Date {
  let max = dates[0] ?? new Date(0);
  for (const d of dates) {
    if (d && d.getTime() > max.getTime()) max = d;
  }
  return max;
}

function placeForwardStage(args: {
  order: PlannerOrderInput;
  stage: PlannerOrderInput['stages'][number];
  earliestStart: Date;
  calendar: WorkingCalendar;
  workers: WorkerCandidate[];
  capacity: CapacityTracker;
  horizon: Date;
}): PlannedAllocation | null {
  const { order, stage, earliestStart, calendar, workers, capacity, horizon } = args;

  if (stage.isPinned && stage.pinnedStart && stage.pinnedEnd) {
    const employeeId =
      stage.preferredEmployeeId ??
      assignWorker({
        workers,
        departmentCode: stage.departmentCode,
        stageDefinitionId: stage.stageDefinitionId,
        capacity,
      })?.id ??
      null;
    if (employeeId) {
      capacity.forceReserve({
        employeeId,
        start: stage.pinnedStart,
        end: stage.pinnedEnd,
        allocationId: `${order.id}:${stage.code}`,
      });
    }
    return {
      orderId: order.id,
      stageCode: stage.code,
      stageDefinitionId: stage.stageDefinitionId,
      productionTaskId: stage.productionTaskId ?? null,
      stageInstanceId: stage.stageInstanceId ?? null,
      resourceType: employeeId ? 'EMPLOYEE' : 'DEPARTMENT',
      employeeId,
      departmentCode: stage.departmentCode,
      plannedStart: stage.pinnedStart,
      plannedEnd: stage.pinnedEnd,
      estimatedMinutes: stage.estimatedMinutes,
      isPinned: true,
    };
  }

  const eligible = listEligibleWorkers({
    workers,
    departmentCode: stage.departmentCode,
    stageDefinitionId: stage.stageDefinitionId,
    preferredEmployeeId: stage.preferredEmployeeId,
    capacity,
  });

  if (eligible.length === 0) {
    // Department-only booking without a named worker
    const start = calendar.nextWorkingInstant(earliestStart);
    const end = calendar.addWorkingMinutes(start, stage.estimatedMinutes);
    return {
      orderId: order.id,
      stageCode: stage.code,
      stageDefinitionId: stage.stageDefinitionId,
      productionTaskId: stage.productionTaskId ?? null,
      stageInstanceId: stage.stageInstanceId ?? null,
      resourceType: 'DEPARTMENT',
      employeeId: null,
      departmentCode: stage.departmentCode,
      plannedStart: start,
      plannedEnd: end,
      estimatedMinutes: stage.estimatedMinutes,
      isPinned: !!stage.isPinned,
    };
  }

  let best: { workerId: string; start: Date; end: Date } | null = null;

  for (const worker of eligible) {
    const fit = capacity.earliestFit(
      worker.id,
      earliestStart,
      stage.estimatedMinutes,
      (instant) => calendar.nextWorkingInstant(instant),
      (start, minutes) => calendar.addWorkingMinutes(start, minutes),
      horizon,
    );
    if (!fit) continue;
    if (
      !best ||
      fit.start.getTime() < best.start.getTime() ||
      (fit.start.getTime() === best.start.getTime() && worker.id.localeCompare(best.workerId) < 0)
    ) {
      best = { workerId: worker.id, start: fit.start, end: fit.end };
    }
  }

  if (!best) return null;

  capacity.forceReserve({
    employeeId: best.workerId,
    start: best.start,
    end: best.end,
    allocationId: `${order.id}:${stage.code}`,
  });

  return {
    orderId: order.id,
    stageCode: stage.code,
    stageDefinitionId: stage.stageDefinitionId,
    productionTaskId: stage.productionTaskId ?? null,
    stageInstanceId: stage.stageInstanceId ?? null,
    resourceType: 'EMPLOYEE',
    employeeId: best.workerId,
    departmentCode: stage.departmentCode,
    plannedStart: best.start,
    plannedEnd: best.end,
    estimatedMinutes: stage.estimatedMinutes,
    isPinned: !!stage.isPinned,
  };
}

function scheduleOrderForward(
  order: PlannerOrderInput,
  ctx: PlannerContext,
  capacity: CapacityTracker,
): PlannedAllocation[] {
  const graph = buildDependencyGraph(order.stages);
  const layers = topologicalLayers(graph);
  const parentEnds = new Map<string, Date>();
  const allocations: PlannedAllocation[] = [];
  const horizon =
    ctx.horizon ?? new Date(ctx.now.getTime() + 2 * 365 * 24 * 60 * 60 * 1000);

  const baseStart = maxDate([
    ctx.now,
    order.materialReadyAt,
    order.productionReadyAt,
  ]);

  for (const layer of layers) {
    for (const code of layer) {
      if (!areParentsReady(code, parentEnds.keys(), graph)) {
        throw new Error(`Parents not ready for stage ${code}`);
      }
      const stage = order.stages.find((s) => s.code === code)!;
      const mergeAt = mergeWaitInstant(code, parentEnds, graph);
      const earliest = maxDate([baseStart, mergeAt]);

      const placed = placeForwardStage({
        order,
        stage,
        earliestStart: earliest,
        calendar: ctx.calendar,
        workers: ctx.workers,
        capacity,
        horizon,
      });
      if (!placed) {
        throw new Error(`Unable to place stage ${code} for order ${order.id}`);
      }
      allocations.push(placed);
      parentEnds.set(code, placed.plannedEnd);
    }
  }

  return allocations;
}

/**
 * Forward finite-capacity schedule: earliest feasible working slots.
 */
export function forwardSchedule(
  orders: PlannerOrderInput[],
  ctx: PlannerContext,
): SchedulePlanResult {
  const ordered = sortWithFairness(
    orders.map((o) => ({
      ...o,
      isPinned: !!o.isPinned,
    })),
  );

  const capacity = new CapacityTracker(ctx.existingOccupancy ?? []);
  const allocations: PlannedAllocation[] = [];

  for (const order of ordered) {
    allocations.push(...scheduleOrderForward(order, ctx, capacity));
  }

  const earliestCompletion =
    allocations.length === 0
      ? null
      : allocations.reduce(
          (max, a) => (a.plannedEnd.getTime() > max.getTime() ? a.plannedEnd : max),
          allocations[0]!.plannedEnd,
        );

  return {
    allocations,
    earliestCompletion,
    requestedDateFeasible: true,
    usedBackward: false,
  };
}

function placeBackwardStage(args: {
  order: PlannerOrderInput;
  stage: PlannerOrderInput['stages'][number];
  latestEnd: Date;
  calendar: WorkingCalendar;
  workers: WorkerCandidate[];
  capacity: CapacityTracker;
  notBefore: Date;
}): PlannedAllocation | null {
  const { order, stage, latestEnd, calendar, workers, capacity, notBefore } = args;

  if (stage.isPinned && stage.pinnedStart && stage.pinnedEnd) {
    const employeeId =
      stage.preferredEmployeeId ??
      assignWorker({
        workers,
        departmentCode: stage.departmentCode,
        stageDefinitionId: stage.stageDefinitionId,
        capacity,
      })?.id ??
      null;
    if (employeeId) {
      capacity.forceReserve({
        employeeId,
        start: stage.pinnedStart,
        end: stage.pinnedEnd,
        allocationId: `${order.id}:${stage.code}`,
      });
    }
    return {
      orderId: order.id,
      stageCode: stage.code,
      stageDefinitionId: stage.stageDefinitionId,
      productionTaskId: stage.productionTaskId ?? null,
      stageInstanceId: stage.stageInstanceId ?? null,
      resourceType: employeeId ? 'EMPLOYEE' : 'DEPARTMENT',
      employeeId,
      departmentCode: stage.departmentCode,
      plannedStart: stage.pinnedStart,
      plannedEnd: stage.pinnedEnd,
      estimatedMinutes: stage.estimatedMinutes,
      isPinned: true,
    };
  }

  const eligible = listEligibleWorkers({
    workers,
    departmentCode: stage.departmentCode,
    stageDefinitionId: stage.stageDefinitionId,
    preferredEmployeeId: stage.preferredEmployeeId,
    capacity,
  });

  const endAnchor = calendar.previousWorkingInstant(latestEnd);
  let start = calendar.subtractWorkingMinutes(endAnchor, stage.estimatedMinutes);
  let end = calendar.addWorkingMinutes(start, stage.estimatedMinutes);

  // Nudge earlier until no overlap / before notBefore fails
  for (let i = 0; i < 5_000; i++) {
    if (start.getTime() < notBefore.getTime()) return null;

    if (eligible.length === 0) {
      return {
        orderId: order.id,
        stageCode: stage.code,
        stageDefinitionId: stage.stageDefinitionId,
        productionTaskId: stage.productionTaskId ?? null,
        stageInstanceId: stage.stageInstanceId ?? null,
        resourceType: 'DEPARTMENT',
        employeeId: null,
        departmentCode: stage.departmentCode,
        plannedStart: start,
        plannedEnd: end,
        estimatedMinutes: stage.estimatedMinutes,
        isPinned: !!stage.isPinned,
      };
    }

    // Prefer least-loaded eligible that has no overlap in this window
    const free = eligible.find((w) => !capacity.hasOverlap(w.id, start, end));
    if (free) {
      capacity.forceReserve({
        employeeId: free.id,
        start,
        end,
        allocationId: `${order.id}:${stage.code}`,
      });
      return {
        orderId: order.id,
        stageCode: stage.code,
        stageDefinitionId: stage.stageDefinitionId,
        productionTaskId: stage.productionTaskId ?? null,
        stageInstanceId: stage.stageInstanceId ?? null,
        resourceType: 'EMPLOYEE',
        employeeId: free.id,
        departmentCode: stage.departmentCode,
        plannedStart: start,
        plannedEnd: end,
        estimatedMinutes: stage.estimatedMinutes,
        isPinned: !!stage.isPinned,
      };
    }

    // Step earlier past the earliest overlapping booking among eligible workers
    let stepTo = start.getTime();
    for (const w of eligible) {
      for (const ov of capacity.findOverlaps(w.id, start, end)) {
        if (ov.start.getTime() < stepTo) stepTo = ov.start.getTime();
      }
    }
    const newEnd = calendar.previousWorkingInstant(new Date(stepTo));
    start = calendar.subtractWorkingMinutes(newEnd, stage.estimatedMinutes);
    end = calendar.addWorkingMinutes(start, stage.estimatedMinutes);
  }

  return null;
}

function scheduleOrderBackward(
  order: PlannerOrderInput,
  ctx: PlannerContext,
  capacity: CapacityTracker,
  targetCompletion: Date,
): PlannedAllocation[] | null {
  const graph = buildDependencyGraph(order.stages);
  const layers = topologicalLayers(graph).slice().reverse();
  const childStarts = new Map<string, Date>();
  const stageEnds = new Map<string, Date>();
  const allocations: PlannedAllocation[] = [];

  const notBefore = maxDate([
    ctx.now,
    order.materialReadyAt,
    order.productionReadyAt,
  ]);

  // Seed sinks with target completion
  const allCodes = [...graph.nodes.keys()];
  const sinks = allCodes.filter((c) => (graph.dependents.get(c) ?? []).length === 0);
  for (const sink of sinks) {
    childStarts.set(sink, targetCompletion);
  }

  for (const layer of layers) {
    for (const code of layer) {
      const stage = order.stages.find((s) => s.code === code)!;
      const dependents = graph.dependents.get(code) ?? [];
      let latestEnd = targetCompletion;
      if (dependents.length > 0) {
        latestEnd = dependents.reduce((min, d) => {
          const s = childStarts.get(d) ?? stageEnds.get(d);
          if (!s) return min;
          return s.getTime() < min.getTime() ? s : min;
        }, targetCompletion);
      } else {
        latestEnd = childStarts.get(code) ?? targetCompletion;
      }

      const placed = placeBackwardStage({
        order,
        stage,
        latestEnd,
        calendar: ctx.calendar,
        workers: ctx.workers,
        capacity,
        notBefore,
      });
      if (!placed) return null;

      allocations.push(placed);
      stageEnds.set(code, placed.plannedEnd);
      childStarts.set(code, placed.plannedStart);

      // Parents must finish before this start
      for (const parent of graph.parents.get(code) ?? []) {
        const existing = childStarts.get(parent);
        if (!existing || placed.plannedStart.getTime() < existing.getTime()) {
          childStarts.set(parent, placed.plannedStart);
        }
      }
    }
  }

  // Validate parent ordering after placement
  for (const alloc of allocations) {
    const parents = graph.parents.get(alloc.stageCode) ?? [];
    for (const p of parents) {
      const parentEnd = stageEnds.get(p);
      if (parentEnd && alloc.plannedStart.getTime() < parentEnd.getTime()) {
        return null;
      }
    }
  }

  return allocations;
}

/**
 * Backward schedule from requestedDeliveryDate − buffer.
 * Falls back to forward when infeasible and sets requestedDateFeasible=false.
 */
export function backwardSchedule(
  orders: PlannerOrderInput[],
  ctx: PlannerContext,
): SchedulePlanResult {
  const ordered = sortWithFairness(
    orders.map((o) => ({
      ...o,
      isPinned: !!o.isPinned,
    })),
  );

  const capacity = new CapacityTracker(ctx.existingOccupancy ?? []);
  const allocations: PlannedAllocation[] = [];
  let allFeasible = true;

  for (const order of ordered) {
    if (!order.requestedDeliveryDate) {
      allocations.push(...scheduleOrderForward(order, ctx, capacity));
      continue;
    }

    const buffer = order.bufferMinutes ?? 0;
    const target = ctx.calendar.subtractWorkingMinutes(
      order.requestedDeliveryDate,
      buffer,
    );

    const trialCapacity = capacity.clone();
    const backwardPlaced = scheduleOrderBackward(order, ctx, trialCapacity, target);
    if (!backwardPlaced) {
      allFeasible = false;
      allocations.push(...scheduleOrderForward(order, ctx, capacity));
      continue;
    }

    // Commit trial reservations into main capacity
    for (const a of backwardPlaced) {
      if (a.employeeId) {
        capacity.forceReserve({
          employeeId: a.employeeId,
          start: a.plannedStart,
          end: a.plannedEnd,
          allocationId: `${a.orderId}:${a.stageCode}`,
        });
      }
      allocations.push(a);
    }
  }

  const earliestCompletion =
    allocations.length === 0
      ? null
      : allocations.reduce(
          (max, a) => (a.plannedEnd.getTime() > max.getTime() ? a.plannedEnd : max),
          allocations[0]!.plannedEnd,
        );

  return {
    allocations,
    earliestCompletion,
    requestedDateFeasible: allFeasible,
    usedBackward: allFeasible,
  };
}
