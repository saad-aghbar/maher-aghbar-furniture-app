import type { CapacityTracker } from './capacity';
import type { WorkerCandidate } from './types';

export interface AssignWorkerInput {
  workers: WorkerCandidate[];
  /** Kept for callers / department-resource fallback booking; not used for eligibility. */
  departmentCode: string | null;
  stageDefinitionId?: string | null;
  /** Prefer this worker when still eligible. */
  preferredEmployeeId?: string | null;
  capacity?: CapacityTracker;
}

/**
 * Eligibility: active + stage skill match when a stage is provided.
 * Department is not used — workers are matched by Stage Skills only.
 * Empty skills with a required stage → ineligible.
 */
export function isEligible(
  worker: WorkerCandidate,
  _departmentCode: string | null,
  stageDefinitionId?: string | null,
): boolean {
  if (!worker.isActive) return false;
  if (stageDefinitionId) {
    const skills = worker.skillStageDefinitionIds ?? [];
    return skills.includes(stageDefinitionId);
  }
  return true;
}

function loadOf(worker: WorkerCandidate, capacity?: CapacityTracker): number {
  if (capacity) return capacity.loadedMinutes(worker.id);
  return worker.loadedMinutes ?? 0;
}

/**
 * Pick the least-loaded eligible worker.
 * Eligibility: active + required stage skill (when stageDefinitionId is set).
 * Ties break by worker id for determinism.
 */
export function assignWorker(input: AssignWorkerInput): WorkerCandidate | null {
  const { workers, departmentCode, stageDefinitionId, preferredEmployeeId, capacity } =
    input;

  const eligible = workers
    .filter((w) => isEligible(w, departmentCode, stageDefinitionId))
    .sort((a, b) => {
      const loadDiff = loadOf(a, capacity) - loadOf(b, capacity);
      if (loadDiff !== 0) return loadDiff;
      return a.id.localeCompare(b.id);
    });

  if (eligible.length === 0) return null;

  if (preferredEmployeeId) {
    const preferred = eligible.find((w) => w.id === preferredEmployeeId);
    if (preferred) return preferred;
  }

  return eligible[0] ?? null;
}

export function listEligibleWorkers(input: AssignWorkerInput): WorkerCandidate[] {
  return input.workers
    .filter((w) => isEligible(w, input.departmentCode, input.stageDefinitionId))
    .sort((a, b) => {
      const loadDiff = loadOf(a, input.capacity) - loadOf(b, input.capacity);
      if (loadDiff !== 0) return loadDiff;
      return a.id.localeCompare(b.id);
    });
}
