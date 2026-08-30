/**
 * Production readiness — assignment + date policy + start gates.
 *
 * Policy is centralized so future variants (OPENING_STAGES_ONLY, DEPARTMENT_COVERAGE)
 * can be added without rewriting callers. v1 implements ALL_EXECUTABLE_STAGES only.
 */

export type AssignmentReadinessPolicy = 'ALL_EXECUTABLE_STAGES';
// Reserved (not implemented): 'OPENING_STAGES_ONLY' | 'DEPARTMENT_COVERAGE'

export const ASSIGNMENT_READINESS_POLICY: AssignmentReadinessPolicy =
  'ALL_EXECUTABLE_STAGES';

export const STARTABLE_PO_STATUSES = [
  'DRAFT',
  'PLANNED',
  'READY',
  'WAITING_FOR_MATERIALS',
] as const;

export type StartablePoStatus = (typeof STARTABLE_PO_STATUSES)[number];

export type ProductionBoardBucket =
  | 'needs_setup'
  | 'ready_to_start'
  | 'on_floor'
  | 'blocked'
  | 'inspection_packaging'
  | 'completed';

export type ReadinessReasonCode =
  | 'MISSING_ASSIGNMENT'
  | 'MISSING_DATE'
  | 'NO_EXECUTABLE_TASKS'
  | 'MATERIALS_HOLD'
  | 'STATUS_NOT_STARTABLE'
  | 'OPEN_BLOCKER';

export type ReadinessMissingAssignment = {
  taskId: string;
  stageId: string | null;
  stageCode: string;
  stageName: string;
};

export type ReadinessMissingDate = {
  taskId: string;
  stageId: string | null;
  stageCode: string;
  stageName: string;
};

export type ReadinessReason = {
  code: ReadinessReasonCode;
  stageId?: string | null;
  stageCode?: string;
  stageName?: string;
  taskId?: string;
  message?: string;
};

export type ProductionReadinessDto = {
  policy: AssignmentReadinessPolicy;
  canStart: boolean;
  /** Soft: materials reserved / not on hold — does not hard-block start in v1 API. */
  materialsReady: boolean;
  workflowReady: boolean;
  /** Soft: any schedule row present for the PO. Planning does not require schedule generate. */
  schedulePresent: boolean;
  /** All executable tasks have an assignee. */
  workersReady: boolean;
  /** All executable tasks have plannedStart and/or plannedCompletion. */
  datesReady: boolean;
  setupReady: boolean;
  assignment: {
    required: number;
    assigned: number;
    missing: ReadinessMissingAssignment[];
  };
  dates: {
    required: number;
    ready: number;
    missing: ReadinessMissingDate[];
  };
  blockers: Array<{ kind: string; taskId?: string; message?: string }>;
  reasons: ReadinessReason[];
  boardBucket: ProductionBoardBucket;
};

export type ExecutableTaskInput = {
  id: string;
  status: string;
  isRework?: boolean | null;
  assignedEmployeeId?: string | null;
  plannedStart?: Date | string | null;
  plannedCompletion?: Date | string | null;
  stageDefinition?: {
    id?: string;
    code?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    executionKind?: string | null;
  } | null;
  stageInstanceId?: string | null;
  blockers?: Array<{
    id?: string;
    category?: string | null;
    reason?: string | null;
    note?: string | null;
    resolvedAt?: Date | string | null;
  }>;
};

export type AssessReadinessInput = {
  status: string;
  currentStageCode?: string | null;
  tasks: ExecutableTaskInput[];
  schedulePresent?: boolean;
  /** Open task blockers already filtered, or derived from tasks. */
  openBlockers?: Array<{ kind: string; taskId?: string; message?: string }>;
  now?: Date;
  requiredDeliveryDate?: Date | string | null;
  isLate?: boolean;
  /**
   * Commercial Production Setup released (or N/A). Defaults true when omitted —
   * Piece 2 gate is upstream; Piece 3 assumes PO exists after release.
   */
  setupReady?: boolean;
};

/** Floor-executable tasks: non-cancelled, non-rework, non-LOGISTICS / non-DELIVERY. */
export function isExecutableProductionTask(task: ExecutableTaskInput): boolean {
  if (task.status === 'CANCELLED') return false;
  if (task.isRework) return false;
  const kind = String(task.stageDefinition?.executionKind ?? '').toUpperCase();
  if (kind === 'LOGISTICS') return false;
  const code = String(task.stageDefinition?.code ?? '').toUpperCase();
  if (code === 'DELIVERY') return false;
  return true;
}

export function listExecutableTasks(tasks: ExecutableTaskInput[]): ExecutableTaskInput[] {
  return tasks.filter(isExecutableProductionTask);
}

export function taskHasPlannedTiming(task: ExecutableTaskInput): boolean {
  const start = task.plannedStart ? new Date(task.plannedStart) : null;
  const end = task.plannedCompletion ? new Date(task.plannedCompletion) : null;
  const startOk = start != null && !Number.isNaN(start.getTime());
  const endOk = end != null && !Number.isNaN(end.getTime());
  // Prefer both when start is set; otherwise either plannedStart or plannedCompletion counts.
  if (startOk && !endOk) return false;
  return startOk || endOk;
}

function stageNameOf(task: ExecutableTaskInput): string {
  return (
    task.stageDefinition?.nameEn ||
    task.stageDefinition?.nameAr ||
    task.stageDefinition?.code ||
    'Stage'
  );
}

function deriveOpenBlockers(
  tasks: ExecutableTaskInput[],
  explicit?: AssessReadinessInput['openBlockers'],
): Array<{ kind: string; taskId?: string; message?: string }> {
  if (explicit) return explicit;
  const out: Array<{ kind: string; taskId?: string; message?: string }> = [];
  for (const task of tasks) {
    for (const b of task.blockers ?? []) {
      if (b.resolvedAt) continue;
      out.push({
        kind: b.category ?? 'OTHER',
        taskId: task.id,
        message: b.reason ?? b.note ?? undefined,
      });
    }
  }
  return out;
}

export function assessAssignmentReadiness(tasks: ExecutableTaskInput[]): {
  required: number;
  assigned: number;
  missing: ReadinessMissingAssignment[];
} {
  const executable = listExecutableTasks(tasks);
  const missing: ReadinessMissingAssignment[] = [];
  let assigned = 0;
  for (const task of executable) {
    if (task.assignedEmployeeId) {
      assigned += 1;
    } else {
      missing.push({
        taskId: task.id,
        stageId: task.stageDefinition?.id ?? task.stageInstanceId ?? null,
        stageCode: String(task.stageDefinition?.code ?? 'UNKNOWN'),
        stageName: stageNameOf(task),
      });
    }
  }
  return { required: executable.length, assigned, missing };
}

export function assessDatesReadiness(tasks: ExecutableTaskInput[]): {
  required: number;
  ready: number;
  missing: ReadinessMissingDate[];
} {
  const executable = listExecutableTasks(tasks);
  const missing: ReadinessMissingDate[] = [];
  let ready = 0;
  for (const task of executable) {
    if (taskHasPlannedTiming(task)) {
      ready += 1;
    } else {
      missing.push({
        taskId: task.id,
        stageId: task.stageDefinition?.id ?? task.stageInstanceId ?? null,
        stageCode: String(task.stageDefinition?.code ?? 'UNKNOWN'),
        stageName: stageNameOf(task),
      });
    }
  }
  return { required: executable.length, ready, missing };
}

function isInspectionOrPackaging(status: string, currentStageCode?: string | null): boolean {
  if (status === 'QUALITY_CHECK' || status === 'READY_FOR_PACKAGING') return true;
  const code = String(currentStageCode ?? '').toUpperCase();
  return code === 'INSPECTION' || code === 'PACKAGING';
}

/**
 * Resolve board bucket for factory manager overview.
 * Assignment or date incompleteness → needs_setup (Needs planning) while pre-floor.
 * Materials hold / open blockers → blocked (Attention). Materials alone do not force needs_setup.
 */
export function resolveBoardBucket(input: {
  status: string;
  currentStageCode?: string | null;
  assignmentComplete: boolean;
  datesComplete: boolean;
  materialsReady: boolean;
  workflowReady: boolean;
  hasOpenBlockers: boolean;
  isLate?: boolean;
}): ProductionBoardBucket {
  const status = input.status;

  if (status === 'COMPLETED' || status === 'READY_FOR_DELIVERY' || status === 'CANCELLED') {
    return 'completed';
  }

  if (status === 'ON_HOLD' || status === 'WAITING_FOR_MATERIALS' || input.hasOpenBlockers) {
    return 'blocked';
  }

  if (isInspectionOrPackaging(status, input.currentStageCode)) {
    return 'inspection_packaging';
  }

  if (status === 'IN_PROGRESS') {
    return 'on_floor';
  }

  // Pre-floor startable set — planning incomplete → Needs planning
  if (STARTABLE_PO_STATUSES.includes(status as StartablePoStatus)) {
    if (!input.workflowReady || !input.assignmentComplete || !input.datesComplete) {
      return 'needs_setup';
    }
    return 'ready_to_start';
  }

  if (input.isLate) return 'blocked';
  return 'needs_setup';
}

/**
 * Assess full readiness DTO for a production order.
 * Hard start gate: assignment + dates + workflow + startable status.
 * materialsReady / MATERIALS_HOLD is soft for UX boards.
 */
export function assessProductionReadiness(input: AssessReadinessInput): ProductionReadinessDto {
  const materialsReady = input.status !== 'WAITING_FOR_MATERIALS';
  const assignment = assessAssignmentReadiness(input.tasks);
  const dates = assessDatesReadiness(input.tasks);
  const workflowReady = assignment.required > 0;
  const workersReady = workflowReady && assignment.missing.length === 0;
  const datesReady = workflowReady && dates.missing.length === 0;
  const setupReady = input.setupReady !== false;
  const schedulePresent = Boolean(input.schedulePresent);
  const blockers = deriveOpenBlockers(input.tasks, input.openBlockers);
  const reasons: ReadinessReason[] = [];

  const statusStartable = STARTABLE_PO_STATUSES.includes(input.status as StartablePoStatus);
  if (!statusStartable) {
    reasons.push({
      code: 'STATUS_NOT_STARTABLE',
      message: `Cannot start production order in status ${input.status}.`,
    });
  }
  if (!workflowReady) {
    reasons.push({
      code: 'NO_EXECUTABLE_TASKS',
      message: 'No executable production stages exist for this order.',
    });
  }
  for (const m of assignment.missing) {
    reasons.push({
      code: 'MISSING_ASSIGNMENT',
      taskId: m.taskId,
      stageId: m.stageId,
      stageCode: m.stageCode,
      stageName: m.stageName,
      message: `${m.stageName} requires an assigned worker.`,
    });
  }
  for (const m of dates.missing) {
    reasons.push({
      code: 'MISSING_DATE',
      taskId: m.taskId,
      stageId: m.stageId,
      stageCode: m.stageCode,
      stageName: m.stageName,
      message: `${m.stageName} requires planned start and/or completion dates.`,
    });
  }
  if (!materialsReady) {
    reasons.push({
      code: 'MATERIALS_HOLD',
      message: 'Materials are not fully ready (waiting for materials).',
    });
  }
  for (const b of blockers) {
    reasons.push({
      code: 'OPEN_BLOCKER',
      taskId: b.taskId,
      message: b.message ?? b.kind,
    });
  }

  /** Hard gate: status + workflow + all assignments + all dates. Materials hold is soft. */
  const hardCodes: ReadinessReasonCode[] = [
    'MISSING_ASSIGNMENT',
    'MISSING_DATE',
    'NO_EXECUTABLE_TASKS',
    'STATUS_NOT_STARTABLE',
  ];
  const hardReasons = reasons.filter((r) => hardCodes.includes(r.code));
  const canStart =
    hardReasons.length === 0 &&
    statusStartable &&
    workflowReady &&
    workersReady &&
    datesReady;

  const boardBucket = resolveBoardBucket({
    status: input.status,
    currentStageCode: input.currentStageCode,
    assignmentComplete: workersReady,
    datesComplete: datesReady,
    materialsReady,
    workflowReady,
    hasOpenBlockers: blockers.length > 0,
    isLate: input.isLate,
  });

  return {
    policy: ASSIGNMENT_READINESS_POLICY,
    canStart,
    materialsReady,
    workflowReady,
    schedulePresent,
    workersReady,
    datesReady,
    setupReady,
    assignment,
    dates,
    blockers,
    reasons,
    boardBucket,
  };
}

export function productionNotReadyException(readiness: ProductionReadinessDto) {
  const hard = readiness.reasons.filter(
    (r) =>
      r.code === 'MISSING_ASSIGNMENT' ||
      r.code === 'MISSING_DATE' ||
      r.code === 'NO_EXECUTABLE_TASKS' ||
      r.code === 'STATUS_NOT_STARTABLE',
  );
  return {
    code: 'PRODUCTION_NOT_READY' as const,
    message: 'Production is not ready to start.',
    reasons: hard.length > 0 ? hard : readiness.reasons,
  };
}
