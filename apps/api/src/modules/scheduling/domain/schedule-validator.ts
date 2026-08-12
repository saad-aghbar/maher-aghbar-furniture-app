import type { WorkingCalendar } from './working-calendar';
import type {
  AllocationToValidate,
  ScheduleValidationResult,
  ValidationIssue,
  ValidationSeverity,
} from './types';

const SEVERITY_RANK: Record<ValidationSeverity, number> = {
  VALID: 0,
  WARNING: 1,
  CONFLICT: 2,
};

function worse(a: ValidationSeverity, b: ValidationSeverity): ValidationSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function sameInstant(a?: Date | null, b?: Date | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export interface ValidateScheduleInput {
  allocations: AllocationToValidate[];
  calendar: WorkingCalendar;
}

/**
 * Validate planned allocations for deps order, worker overlap, calendar, and pinned moves.
 */
export function validateSchedule(input: ValidateScheduleInput): ScheduleValidationResult {
  const issues: ValidationIssue[] = [];
  let severity: ValidationSeverity = 'VALID';

  const add = (issue: ValidationIssue) => {
    issues.push(issue);
    severity = worse(severity, issue.severity);
  };

  const byOrder = new Map<string, AllocationToValidate[]>();
  for (const alloc of input.allocations) {
    const list = byOrder.get(alloc.orderId) ?? [];
    list.push(alloc);
    byOrder.set(alloc.orderId, list);

    if (alloc.plannedEnd.getTime() <= alloc.plannedStart.getTime()) {
      add({
        code: 'INVALID_WINDOW',
        severity: 'CONFLICT',
        message: 'plannedEnd must be after plannedStart',
        allocationKey: alloc.key,
      });
    }

    // Calendar: start must be a working instant; span may cross breaks but endpoints checked lightly
    if (!input.calendar.isWorking(alloc.plannedStart)) {
      add({
        code: 'NON_WORKING_START',
        severity: 'WARNING',
        message: 'Allocation starts outside working time',
        allocationKey: alloc.key,
      });
    }

    // Pinned moves
    if (alloc.isPinned && (alloc.previousPinnedStart || alloc.previousPinnedEnd)) {
      const moved =
        !sameInstant(alloc.plannedStart, alloc.previousPinnedStart) ||
        !sameInstant(alloc.plannedEnd, alloc.previousPinnedEnd);
      if (moved) {
        add({
          code: 'PINNED_MOVED',
          severity: 'CONFLICT',
          message: 'Pinned allocation was moved',
          allocationKey: alloc.key,
        });
      }
    }
  }

  // Dependency order per order
  for (const [, allocs] of byOrder) {
    const byCode = new Map(allocs.map((a) => [a.stageCode, a]));
    for (const alloc of allocs) {
      for (const parentCode of alloc.dependsOnCodes) {
        const parent = byCode.get(parentCode);
        if (!parent) continue;
        if (alloc.plannedStart.getTime() < parent.plannedEnd.getTime()) {
          add({
            code: 'DEPENDENCY_ORDER',
            severity: 'CONFLICT',
            message: `Stage ${alloc.stageCode} starts before parent ${parentCode} ends`,
            allocationKey: alloc.key,
          });
        }
      }
    }
  }

  // Worker overlaps across all allocations
  const withWorkers = input.allocations.filter((a) => a.employeeId);
  for (let i = 0; i < withWorkers.length; i++) {
    for (let j = i + 1; j < withWorkers.length; j++) {
      const a = withWorkers[i]!;
      const b = withWorkers[j]!;
      if (a.employeeId !== b.employeeId) continue;
      if (intervalsOverlap(a.plannedStart, a.plannedEnd, b.plannedStart, b.plannedEnd)) {
        add({
          code: 'WORKER_OVERLAP',
          severity: 'CONFLICT',
          message: `Worker ${a.employeeId} double-booked`,
          allocationKey: a.key,
        });
      }
    }
  }

  return { severity, issues };
}
