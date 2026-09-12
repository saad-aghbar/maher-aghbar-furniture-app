/**
 * Role-scoped production workflow stage projections for sales/production order APIs.
 */

import { livePercentFromTaskRow } from './live-task-progress';
import { buildTaskTimingSummary, closedSecondsFromTimeEntries } from './task-timing.util';

export type WorkflowStagePhoto = {
  id: string;
  fileName: string;
  mimeType: string | null;
};

export type WorkflowStageSafe = {
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe: string | null;
  sortOrder: number;
  dependsOnCodes: string[];
  status: string;
  progressPercent: number;
  /** Completion / work photos for this stage (dealers: completed stages only). */
  photos: WorkflowStagePhoto[];
};

export type WorkflowStageAdmin = WorkflowStageSafe & {
  actualStart: Date | string | null;
  actualEnd: Date | string | null;
  plannedEnd: Date | string | null;
  notes: string | null;
  isOverdue: boolean;
  assignees: Array<{
    id: string;
    name: string;
    elapsedMinutes: number;
    actualMinutes: number;
    actualSeconds: number;
    running: boolean;
    /** ISO start of open timer segment when `running` (for live clocks). */
    openStartedAt: string | null;
    estimatedMinutes: number | null;
    plannedCompletion: string | null;
  }>;
  blockers: Array<{ id: string; category: string; reason: string }>;
  attachmentCount: number;
  inspectionStatus?: string | null;
  inspectionProgress?: { passed: number; total: number; status?: string | null } | null;
  backForRework?: boolean;
};

export type StagePhotoDoc = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category?: string | null;
};

type StageDef = {
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  sortOrder: number;
  dependsOnCodes?: string[] | null;
};

type StageTask = {
  id?: string;
  status?: string;
  actualMinutes?: number | null;
  estimatedMinutes?: number | null;
  plannedCompletion?: Date | string | null;
  timeEntries?: Array<{ startedAt: Date | string; endedAt?: Date | string | null }>;
  assignedEmployee?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  blockers?: Array<{
    id: string;
    category: string;
    reason: string;
    resolvedAt?: Date | string | null;
  }>;
  notes?: string | null;
};

type StageRow = {
  status: string;
  progressPercent?: number | null;
  actualStart?: Date | string | null;
  actualEnd?: Date | string | null;
  plannedEnd?: Date | string | null;
  notes?: string | null;
  inspectionStatus?: string | null;
  stageDefinition?: StageDef | null;
  tasks?: StageTask[];
};

function fallbackStageDef(s: StageRow): StageDef {
  const def = s.stageDefinition;
  return {
    code: def?.code ?? '',
    nameEn: def?.nameEn ?? def?.code ?? '',
    nameAr: def?.nameAr ?? def?.code ?? '',
    nameHe: def?.nameHe ?? null,
    sortOrder: def?.sortOrder ?? 0,
    dependsOnCodes: def?.dependsOnCodes ?? [],
  };
}

function employeeName(emp: { firstName: string; lastName: string }): string {
  return `${emp.firstName} ${emp.lastName}`.trim();
}

function isStageComplete(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'COMPLETED' || s === 'SKIPPED' || s === 'DONE';
}

/** Photos linked to tasks on this stage via category `TASK_PHOTO:{taskId}`. */
export function photosForStage(
  stage: StageRow,
  docs: StagePhotoDoc[] = [],
): WorkflowStagePhoto[] {
  const taskIds = new Set(
    (stage.tasks ?? []).map((t) => t.id).filter((id): id is string => Boolean(id)),
  );
  if (!taskIds.size || !docs.length) return [];

  const seen = new Set<string>();
  const out: WorkflowStagePhoto[] = [];
  for (const doc of docs) {
    const match = doc.category?.match(/^TASK_PHOTO:(.+)$/);
    if (!match?.[1] || !taskIds.has(match[1])) continue;
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    out.push({
      id: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType ?? null,
    });
  }
  return out;
}

export function mapWorkflowStageSafe(
  s: StageRow,
  docs: StagePhotoDoc[] = [],
): WorkflowStageSafe {
  const def = fallbackStageDef(s);
  const photos = isStageComplete(s.status) ? photosForStage(s, docs) : [];
  return {
    code: def.code,
    nameEn: def.nameEn,
    nameAr: def.nameAr,
    nameHe: def.nameHe ?? null,
    sortOrder: def.sortOrder,
    dependsOnCodes: def.dependsOnCodes ?? [],
    status: s.status,
    progressPercent: Number(s.progressPercent ?? 0),
    photos,
  };
}

export function mapWorkflowStageAdmin(
  s: StageRow,
  docs: StagePhotoDoc[] = [],
): WorkflowStageAdmin {
  const def = fallbackStageDef(s);
  const tasks = s.tasks ?? [];
  const assigneeMap = new Map<
    string,
    {
      id: string;
      name: string;
      elapsedMinutes: number;
      actualMinutes: number;
      actualSeconds: number;
      running: boolean;
      openStartedAt: string | null;
      estimatedMinutes: number | null;
      plannedCompletion: string | null;
    }
  >();
  for (const t of tasks) {
    const emp = t.assignedEmployee;
    if (!emp?.id) continue;
    const open = (t.timeEntries ?? []).find((e) => !e.endedAt);
    const hasClosedEntries = (t.timeEntries ?? []).some((e) => e.endedAt != null);
    const timing = buildTaskTimingSummary({
      status: t.status ?? s.status,
      actualMinutes: t.actualMinutes,
      actualSeconds: hasClosedEntries
        ? closedSecondsFromTimeEntries(t.timeEntries)
        : undefined,
      estimatedMinutes: t.estimatedMinutes,
      plannedCompletion: t.plannedCompletion,
      openStartedAt: open?.startedAt ?? null,
    });
    const running = timing.status === 'running';
    const prev = assigneeMap.get(emp.id);
    if (!prev) {
      assigneeMap.set(emp.id, {
        id: emp.id,
        name: employeeName(emp),
        elapsedMinutes: timing.elapsedMinutes,
        actualMinutes: timing.actualMinutes,
        actualSeconds: timing.actualSeconds,
        running,
        openStartedAt: timing.openStartedAt,
        estimatedMinutes: timing.estimatedMinutes,
        plannedCompletion: timing.plannedCompletion,
      });
    } else {
      const nextOpen =
        running && timing.openStartedAt
          ? !prev.openStartedAt || timing.openStartedAt < prev.openStartedAt
            ? timing.openStartedAt
            : prev.openStartedAt
          : prev.openStartedAt;
      assigneeMap.set(emp.id, {
        ...prev,
        elapsedMinutes: prev.elapsedMinutes + timing.elapsedMinutes,
        actualMinutes: prev.actualMinutes + timing.actualMinutes,
        actualSeconds: prev.actualSeconds + timing.actualSeconds,
        running: prev.running || running,
        openStartedAt: nextOpen,
        estimatedMinutes:
          prev.estimatedMinutes != null || timing.estimatedMinutes != null
            ? (prev.estimatedMinutes ?? 0) + (timing.estimatedMinutes ?? 0)
            : null,
      });
    }
  }
  const blockers = tasks.flatMap((t) =>
    (t.blockers ?? [])
      .filter((b) => !b.resolvedAt)
      .map((b) => ({ id: b.id, category: b.category, reason: b.reason })),
  );
  const notesFromTasks = tasks
    .map((t) => t.notes?.trim())
    .filter(Boolean) as string[];
  const notes =
    s.notes?.trim() ||
    (notesFromTasks.length ? [...new Set(notesFromTasks)].join('\n\n') : null);
  const plannedEnd = s.plannedEnd ?? null;
  const incomplete = !['COMPLETED', 'SKIPPED'].includes(s.status);
  const isOverdue =
    incomplete &&
    plannedEnd != null &&
    new Date(plannedEnd).getTime() < Date.now();

  const photos = photosForStage(s, docs);

  return {
    code: def.code,
    nameEn: def.nameEn,
    nameAr: def.nameAr,
    nameHe: def.nameHe ?? null,
    sortOrder: def.sortOrder,
    dependsOnCodes: def.dependsOnCodes ?? [],
    status: s.status,
    progressPercent: ['COMPLETED', 'DONE'].includes(s.status.toUpperCase())
      ? 100
      : tasks.length
        ? Math.round(
            tasks.reduce(
              (sum, t) =>
                sum +
                livePercentFromTaskRow({
                  ...t,
                  status: t.status ?? s.status,
                }),
              0,
            ) / tasks.length,
          )
        : Number(s.progressPercent ?? 0),
    photos,
    actualStart: s.actualStart ?? null,
    actualEnd: s.actualEnd ?? null,
    plannedEnd,
    notes,
    isOverdue,
    assignees: [...assigneeMap.values()],
    blockers,
    attachmentCount: photos.length,
  };
}

export type InspectionJourneyOverlay = {
  passed: number;
  total: number;
  reworkBackCodes: string[];
};

export function decorateInspectionJourneyFields<T extends { code: string }>(
  stage: T,
  raw: { inspectionStatus?: string | null },
  overlay: InspectionJourneyOverlay,
): T & {
  inspectionStatus: string | null;
  inspectionProgress: { passed: number; total: number; status: string | null } | null;
  backForRework: boolean;
} {
  const code = String(stage.code ?? '').toUpperCase();
  const isInspection = code === 'INSPECTION';
  return {
    ...stage,
    inspectionStatus: isInspection ? raw.inspectionStatus ?? null : null,
    inspectionProgress: null,
    backForRework: overlay.reworkBackCodes.includes(stage.code),
  };
}

/** Strip admin-only fields if a stage object somehow reaches a dealer payload. */
export function sanitizeWorkflowStageForDealer(stage: Record<string, unknown>): WorkflowStageSafe {
  const status = String(stage.status ?? 'PENDING');
  const rawPhotos = Array.isArray(stage.photos) ? stage.photos : [];
  const photos = isStageComplete(status)
    ? rawPhotos
        .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
        .map((p) => ({
          id: String(p.id ?? ''),
          fileName: String(p.fileName ?? 'photo'),
          mimeType: (p.mimeType as string | null) ?? null,
        }))
        .filter((p) => p.id)
    : [];

  return {
    code: String(stage.code ?? ''),
    nameEn: String(stage.nameEn ?? stage.code ?? ''),
    nameAr: String(stage.nameAr ?? stage.code ?? ''),
    nameHe: (stage.nameHe as string | null) ?? null,
    sortOrder: Number(stage.sortOrder ?? 0),
    dependsOnCodes: Array.isArray(stage.dependsOnCodes)
      ? (stage.dependsOnCodes as string[])
      : [],
    status,
    progressPercent: Number(stage.progressPercent ?? 0),
    photos,
  };
}
