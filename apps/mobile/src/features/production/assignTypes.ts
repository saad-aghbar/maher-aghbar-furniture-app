import type { ScheduleConflictItem } from './assignWindow';

/** Shared assign payload — used by ProductionTaskSheet (canonical editor). */
export type AssignWorkerPayload = {
  employeeId: string;
  plannedStart?: string;
  plannedCompletion?: string;
  estimatedMinutes?: number;
  overrideConflict?: boolean;
};

/** Server WORKER_SCHEDULE_CONFLICT details for assign UX. */
export type AssignScheduleConflict = {
  conflicts: ScheduleConflictItem[];
  suggestedWindow?: { plannedStart: string; plannedCompletion: string } | null;
};
