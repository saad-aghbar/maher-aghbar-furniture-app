import type { CapacityTracker } from './capacity';
import type { WorkerCandidate } from './types';

export interface AssignWorkerInput {
  workers: WorkerCandidate[];
  departmentCode: string | null;
  stageDefinitionId?: string | null;
  /** Prefer this worker when still eligible. */
  preferredEmployeeId?: string | null;
  capacity?: CapacityTracker;
}

function isEligible(
  worker: WorkerCandidate,
  departmentCode: string | null,
  stageDefinitionId?: string | null,
): boolean {
  if (!worker.isActive) return false;
  if (departmentCode && worker.departmentCode !== departmentCode) return false;
  if (stageDefinitionId) {
    const skills = worker.skillStageDefinitionIds;
    if (skills && skills.length > 0 && !skills.includes(stageDefinitionId)) {
      return false;
    }
  }
  return true;
}

function loadOf(worker: WorkerCandidate, capacity?: CapacityTracker): number {
  if (capacity) return capacity.loadedMinutes(worker.id);
  return worker.loadedMinutes ?? 0;
}

/**
 * Pick the least-loaded eligible worker.
 * Eligibility: active, department code match (when provided), optional skill for stage.
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
