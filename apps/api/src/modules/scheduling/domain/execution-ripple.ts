/**
 * Execution-driven remainder placement. Pure — never touches Prisma.
 * Planning stays manual; only real overrun facts may move NOT_STARTED windows.
 */
import { addDaysYmd } from './working-calendar';
import type { WorkingCalendar } from './working-calendar';

export type RippleMode = 'tomorrow' | 'overtime';

export type RippleAllocation = {
  allocationId: string;
  taskId: string;
  employeeId: string;
  plannedStart: Date;
  plannedEnd: Date;
  estimatedMinutes: number;
  isPinned: boolean;
  taskStatus: string;
  orderId: string;
};

export type RippleEdge = { fromTaskId: string; toTaskId: string };

export type RippleMove = {
  allocationId: string;
  taskId: string;
  oldStart: Date;
  oldEnd: Date;
  newStart: Date;
  newEnd: Date;
  reason: 'remainder' | 'same_worker_lane' | 'dag_downstream';
};

export type RippleBlocked = {
  allocationId: string;
  taskId: string;
  code: 'PINNED_MOVED' | 'STARTED_TASK';
};

export type PlanExecutionRippleInput = {
  overrunningTaskId: string;
  remainingMinutes: number;
  mode: RippleMode;
  now: Date;
  calendar: WorkingCalendar;
  allocations: RippleAllocation[];
  edges: RippleEdge[];
};

export type PlanExecutionRippleResult = {
  moves: RippleMove[];
  blocked: RippleBlocked[];
  reasons: string[];
};

export type PlanPauseSlideInput = {
  taskId: string;
  pauseWorkingMinutes: number;
  calendar: WorkingCalendar;
  allocations: RippleAllocation[];
  edges: RippleEdge[];
};

const STARTED = new Set(['IN_PROGRESS', 'PAUSED', 'BLOCKED', 'READY_FOR_INSPECTION', 'COMPLETED']);

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

function remainderWindow(
  input: PlanExecutionRippleInput,
  source: RippleAllocation,
): { start: Date; end: Date } {
  const minutes = Math.max(1, input.remainingMinutes);
  if (input.mode === 'tomorrow') {
    const todayYmd = input.calendar.localYmd(input.now);
    const tomorrow = addDaysYmd(todayYmd, 1);
    const start = input.calendar.nextWorkingInstant(input.calendar.localInstant(tomorrow, 0, 0));
    const end = input.calendar.addWorkingMinutes(start, minutes);
    return { start, end };
  }
  const start = input.calendar.nextWorkingInstant(
    input.now.getTime() > source.plannedEnd.getTime() ? input.now : source.plannedEnd,
  );
  const end = input.calendar.addWorkingMinutes(start, minutes);
  return { start, end };
}

function applyRippleFromRemainder(
  source: RippleAllocation,
  remainder: { start: Date; end: Date },
  input: {
    calendar: WorkingCalendar;
    allocations: RippleAllocation[];
    edges: RippleEdge[];
  },
): PlanExecutionRippleResult {
  const moves: RippleMove[] = [];
  const blocked: RippleBlocked[] = [];
  const reasons: string[] = [];

  moves.push({
    allocationId: source.allocationId,
    taskId: source.taskId,
    oldStart: source.plannedStart,
    oldEnd: source.plannedEnd,
    newStart: remainder.start,
    newEnd: remainder.end,
    reason: 'remainder',
  });

  const movedEndByTask = new Map<string, Date>([[source.taskId, remainder.end]]);

  const laterSameWorker = input.allocations
    .filter(
      (a) =>
        a.allocationId !== source.allocationId &&
        a.employeeId === source.employeeId &&
        a.plannedStart.getTime() >= source.plannedStart.getTime(),
    )
    .sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime());

  for (const alloc of laterSameWorker) {
    if (STARTED.has(alloc.taskStatus)) {
      blocked.push({ allocationId: alloc.allocationId, taskId: alloc.taskId, code: 'STARTED_TASK' });
      continue;
    }
    if (alloc.taskStatus !== 'NOT_STARTED') continue;
    if (alloc.isPinned) {
      blocked.push({ allocationId: alloc.allocationId, taskId: alloc.taskId, code: 'PINNED_MOVED' });
      reasons.push('PINNED_MOVED');
      continue;
    }
    if (!overlaps(remainder.start, remainder.end, alloc.plannedStart, alloc.plannedEnd)) continue;
    const duration = Math.max(
      1,
      alloc.estimatedMinutes ||
        Math.round((alloc.plannedEnd.getTime() - alloc.plannedStart.getTime()) / 60000),
    );
    const newStart = input.calendar.nextWorkingInstant(remainder.end);
    const newEnd = input.calendar.addWorkingMinutes(newStart, duration);
    moves.push({
      allocationId: alloc.allocationId,
      taskId: alloc.taskId,
      oldStart: alloc.plannedStart,
      oldEnd: alloc.plannedEnd,
      newStart,
      newEnd,
      reason: 'same_worker_lane',
    });
    movedEndByTask.set(alloc.taskId, newEnd);
  }

  const outgoing = new Map<string, string[]>();
  for (const edge of input.edges) {
    const list = outgoing.get(edge.fromTaskId) ?? [];
    list.push(edge.toTaskId);
    outgoing.set(edge.fromTaskId, list);
  }

  const queue = [source.taskId];
  const seen = new Set<string>();
  while (queue.length) {
    const fromId = queue.shift()!;
    if (seen.has(fromId)) continue;
    seen.add(fromId);
    const predEnd = movedEndByTask.get(fromId);
    if (!predEnd) continue;
    for (const toId of outgoing.get(fromId) ?? []) {
      queue.push(toId);
      const alloc = input.allocations.find((a) => a.taskId === toId);
      if (!alloc) continue;
      if (STARTED.has(alloc.taskStatus)) {
        blocked.push({ allocationId: alloc.allocationId, taskId: alloc.taskId, code: 'STARTED_TASK' });
        continue;
      }
      if (alloc.taskStatus !== 'NOT_STARTED') continue;
      if (alloc.isPinned) {
        blocked.push({ allocationId: alloc.allocationId, taskId: alloc.taskId, code: 'PINNED_MOVED' });
        reasons.push('PINNED_MOVED');
        continue;
      }
      if (alloc.plannedStart.getTime() >= predEnd.getTime()) continue;
      if ((alloc.estimatedMinutes ?? 0) <= 0) {
        const newStart = input.calendar.nextWorkingInstant(predEnd);
        const already = moves.find((m) => m.allocationId === alloc.allocationId);
        if (already) {
          already.newStart = newStart;
          already.newEnd = newStart;
          already.reason = 'dag_downstream';
        } else {
          moves.push({
            allocationId: alloc.allocationId,
            taskId: alloc.taskId,
            oldStart: alloc.plannedStart,
            oldEnd: alloc.plannedEnd,
            newStart,
            newEnd: newStart,
            reason: 'dag_downstream',
          });
        }
        movedEndByTask.set(alloc.taskId, newStart);
        continue;
      }
      const duration = Math.max(
        1,
        alloc.estimatedMinutes ||
          Math.round((alloc.plannedEnd.getTime() - alloc.plannedStart.getTime()) / 60000),
      );
      const newStart = input.calendar.nextWorkingInstant(predEnd);
      const newEnd = input.calendar.addWorkingMinutes(newStart, duration);
      const already = moves.find((m) => m.allocationId === alloc.allocationId);
      if (already) {
        already.newStart = newStart;
        already.newEnd = newEnd;
        already.reason = 'dag_downstream';
      } else {
        moves.push({
          allocationId: alloc.allocationId,
          taskId: alloc.taskId,
          oldStart: alloc.plannedStart,
          oldEnd: alloc.plannedEnd,
          newStart,
          newEnd,
          reason: 'dag_downstream',
        });
      }
      movedEndByTask.set(alloc.taskId, newEnd);
    }
  }

  return { moves, blocked, reasons: [...new Set(reasons)] };
}

export function planExecutionRipple(input: PlanExecutionRippleInput): PlanExecutionRippleResult {
  const source = input.allocations.find((a) => a.taskId === input.overrunningTaskId);
  if (!source) {
    return { moves: [], blocked: [], reasons: ['OVERRUNNING_TASK_NOT_FOUND'] };
  }
  return applyRippleFromRemainder(source, remainderWindow(input, source), input);
}

/** Extend this allocation by pause working minutes; slide later unpinned NOT_STARTED work. */
export function planPauseSlide(input: PlanPauseSlideInput): PlanExecutionRippleResult {
  const source = input.allocations.find((a) => a.taskId === input.taskId);
  if (!source) {
    return { moves: [], blocked: [], reasons: ['OVERRUNNING_TASK_NOT_FOUND'] };
  }
  if (input.pauseWorkingMinutes <= 0) {
    return { moves: [], blocked: [], reasons: [] };
  }
  const newEnd = input.calendar.addWorkingMinutes(source.plannedEnd, input.pauseWorkingMinutes);
  return applyRippleFromRemainder(
    source,
    { start: source.plannedStart, end: newEnd },
    input,
  );
}
