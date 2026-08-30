import { backwardSchedule, forwardSchedule } from '../../../../apps/api/src/modules/scheduling/domain/schedule-planner';
import type {
  OccupancyInterval,
  PlannedAllocation,
  PlannerOrderInput,
  SchedulePlanResult,
  WorkerCandidate,
} from '../../../../apps/api/src/modules/scheduling/domain/types';
import type { WorkingCalendar } from '../../../../apps/api/src/modules/scheduling/domain/working-calendar';
import { addDays } from './clock';
import type { DemoStory, StoryKind } from './stories';

export type DemoPlannerStage = PlannerOrderInput['stages'][number];

export function isHistoricalDemoKind(kind: StoryKind): boolean {
  return kind === 'delivered' || kind === 'rework_historical';
}

export function isIntentionalLateKind(kind: StoryKind): boolean {
  return kind === 'at_risk_committed';
}

/** Current floor stage must not look started for these kinds. */
export function isDemoStageInProgress(kind: StoryKind): boolean {
  return ![
    'not_started',
    'proposed',
    'waiting_materials',
    'at_risk_material',
    'at_risk_wip',
    'fresh_production',
    'draft',
  ].includes(kind);
}

export function atOrBefore(date: Date, cap: Date): Date {
  return date.getTime() > cap.getTime() ? cap : date;
}

function stableOffset(id: string, min = 4, span = 12): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return min + (h % span);
}

/**
 * Required/promised delivery relative to DEMO_AS_OF.
 * Does not change `orderDay` (sales-order numbering sort).
 */
export function presentationRequiredDelivery(story: DemoStory, createdAt: Date, asOf: Date): Date {
  const naive = addDays(createdAt, story.deliveryLeadDays);
  if (isHistoricalDemoKind(story.kind)) {
    return atOrBefore(naive, asOf);
  }
  if (isIntentionalLateKind(story.kind)) {
    return naive;
  }
  if (story.kind === 'ready_delivery' && naive.getTime() <= asOf.getTime()) {
    return addDays(asOf, 3);
  }
  if (naive.getTime() < asOf.getTime()) {
    return addDays(asOf, stableOffset(story.id));
  }
  return naive;
}

function applyOccupancy(occupancy: OccupancyInterval[], allocations: PlannedAllocation[]): void {
  for (const alloc of allocations) {
    if (!alloc.employeeId) continue;
    occupancy.push({
      employeeId: alloc.employeeId,
      start: alloc.plannedStart,
      end: alloc.plannedEnd,
      allocationId: 'demo',
    });
  }
}

export function planDemoAllocations(input: {
  story: DemoStory;
  poId: string;
  dealerId: string;
  priority: PlannerOrderInput['priority'];
  createdAt: Date;
  requiredDelivery: Date;
  asOf: Date;
  stages: DemoPlannerStage[];
  completedCodes: Set<string>;
  calendar: WorkingCalendar;
  workers: WorkerCandidate[];
  occupancy: OccupancyInterval[];
}): SchedulePlanResult {
  const {
    story,
    poId,
    dealerId,
    priority,
    createdAt,
    requiredDelivery,
    asOf,
    stages,
    completedCodes,
    calendar,
    workers,
    occupancy,
  } = input;
  const totalMinutes = stages.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const bufferMinutes = Math.round(0.1 * totalMinutes);
  const ctxBase = { calendar, workers, existingOccupancy: occupancy };

  const makeInput = (subset: DemoPlannerStage[], requested: Date): PlannerOrderInput => ({
    id: poId,
    customerId: dealerId,
    priority,
    committedDeliveryDate: null,
    requestedDeliveryDate: requested,
    latestCompletionTarget: requested,
    createdAt,
    stages: subset,
    bufferMinutes,
  });

  const allocations: PlannedAllocation[] = [];
  let requestedDateFeasible = true;
  let usedBackward = false;
  let planningMode: SchedulePlanResult['planningMode'] = 'BACKWARD';

  const apply = (result: SchedulePlanResult) => {
    allocations.push(...result.allocations);
    applyOccupancy(occupancy, result.allocations);
    requestedDateFeasible = requestedDateFeasible && result.requestedDateFeasible;
    usedBackward = usedBackward || result.usedBackward;
    planningMode = result.planningMode;
  };

  if (isHistoricalDemoKind(story.kind) || isIntentionalLateKind(story.kind)) {
    apply(backwardSchedule([makeInput(stages, requiredDelivery)], { ...ctxBase, now: createdAt }));
  } else {
    const completed = stages.filter((s) => completedCodes.has(s.code));
    const remaining = stages.filter((s) => !completedCodes.has(s.code));
    if (completed.length) {
      apply(backwardSchedule([makeInput(completed, asOf)], { ...ctxBase, now: createdAt }));
    }
    if (remaining.length) {
      if (['not_started', 'proposed', 'waiting_materials', 'at_risk_material'].includes(story.kind)) {
        apply(backwardSchedule([makeInput(remaining, requiredDelivery)], { ...ctxBase, now: asOf }));
      } else {
        apply(forwardSchedule([makeInput(remaining, requiredDelivery)], { ...ctxBase, now: asOf }));
      }
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
    requestedDateFeasible,
    usedBackward,
    planningMode,
  };
}
