/**
 * Production journey + “where now” selectors for the execution dossier.
 * Uses only proven API fields — never invents worker/material history.
 */

import { localizedName } from '@maher/i18n';
import type { ProductionOrderDetail, ProductionTask } from './api';
import type { ProductionTaskRow } from './selectProduction';

export type JourneyStageTiming = 'on_time' | 'late' | 'unknown';

export type ProductionJourneyStage = {
  key: string;
  code: string | null;
  name: string;
  status: string;
  sortOrder: number;
  dependsOnCodes: string[];
  assigneeName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  durationMinutes: number | null;
  timing: JourneyStageTiming;
  hasProblem: boolean;
  problemLabel: string | null;
  /** Linked task id for tap → execution detail */
  primaryTaskId: string | null;
  /** Parallel when other stages share no exclusive dependency chain — UI hint */
  parallelGroup: number;
};

export type ProductionWhereNow = {
  salesOrderNumber: string | null;
  productionOrderNumber: string;
  dealerName: string | null;
  productTitle: string;
  imageUrl: string | null;
  currentStageName: string | null;
  activeWorkerName: string | null;
  completedStageNames: string[];
  waitingStageNames: string[];
  actualStartDate: string | null;
  plannedStartDate: string | null;
  plannedVsActualLabel: 'ahead' | 'on_track' | 'behind' | 'not_started' | 'unknown';
  deliveryDate: string | null;
  progressPercent: number;
  progressLabel: string | null;
  operationalState: string;
  attentionCount: number;
};

function stageDisplayName(
  stage: NonNullable<ProductionOrderDetail['stages']>[number],
  locale: string,
): string {
  if (stage.stageDefinition) {
    const n = localizedName(locale, stage.stageDefinition, '');
    if (n) return n;
  }
  const n = localizedName(
    locale,
    { nameEn: stage.nameEn, nameAr: stage.nameAr, nameHe: stage.nameHe },
    '',
  );
  if (n) return n;
  return stage.code ?? '—';
}

function assigneeFromStage(
  stage: NonNullable<ProductionOrderDetail['stages']>[number],
): string | null {
  const a = stage.assignees?.[0];
  if (a?.name?.trim()) return a.name.trim();
  const task = stage.tasks?.find((t) => t.assignedEmployee);
  if (task?.assignedEmployee) {
    return `${task.assignedEmployee.firstName} ${task.assignedEmployee.lastName}`.trim();
  }
  return null;
}

function timingForStage(
  stage: NonNullable<ProductionOrderDetail['stages']>[number],
): JourneyStageTiming {
  if (stage.isOverdue) return 'late';
  if (stage.actualEnd && stage.plannedEnd) {
    const actual = new Date(stage.actualEnd).getTime();
    const planned = new Date(stage.plannedEnd).getTime();
    if (Number.isFinite(actual) && Number.isFinite(planned)) {
      return actual <= planned ? 'on_time' : 'late';
    }
  }
  return 'unknown';
}

function durationMinutes(
  stage: NonNullable<ProductionOrderDetail['stages']>[number],
): number | null {
  const fromAssignees = stage.assignees?.reduce(
    (sum, a) => sum + (a.elapsedMinutes ?? a.actualMinutes ?? 0),
    0,
  );
  if (fromAssignees && fromAssignees > 0) return Math.round(fromAssignees);
  if (stage.actualStart && stage.actualEnd) {
    const ms =
      new Date(stage.actualEnd).getTime() - new Date(stage.actualStart).getTime();
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms / 60_000);
  }
  return null;
}

/** Assign parallel groups: stages with identical dependsOn signature share a group. */
function parallelGroups(
  stages: Array<{ dependsOnCodes: string[]; sortOrder: number }>,
): number[] {
  const keyToGroup = new Map<string, number>();
  let next = 0;
  return stages.map((s) => {
    const key = [...s.dependsOnCodes].sort().join('|') || `solo:${s.sortOrder}`;
    const existing = keyToGroup.get(key);
    if (existing != null) return existing;
    const g = next++;
    keyToGroup.set(key, g);
    return g;
  });
}

export function selectProductionJourney(
  order: ProductionOrderDetail,
  locale: string,
): ProductionJourneyStage[] {
  const stages = [...(order.stages ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  if (stages.length === 0) {
    // Fallback: synthesize from tasks when stages payload is thin.
    const byCode = new Map<string, ProductionTask[]>();
    for (const task of order.tasks ?? []) {
      const code = task.stageDefinition?.code ?? task.id;
      const list = byCode.get(code) ?? [];
      list.push(task);
      byCode.set(code, list);
    }
    return [...byCode.entries()].map(([code, tasks], index) => {
      const primary = tasks[0]!;
      const name = primary.stageDefinition
        ? localizedName(locale, primary.stageDefinition, primary.name)
        : primary.name;
      const assignee = primary.assignedEmployee
        ? `${primary.assignedEmployee.firstName} ${primary.assignedEmployee.lastName}`.trim()
        : null;
      const openBlockers = (primary.blockers ?? []).filter((b) => !b.resolvedAt);
      return {
        key: `task-stage:${code}`,
        code: primary.stageDefinition?.code ?? null,
        name,
        status: primary.status,
        sortOrder: index,
        dependsOnCodes: [],
        assigneeName: assignee,
        plannedStart: primary.plannedStart ?? null,
        plannedEnd: primary.plannedCompletion ?? null,
        actualStart: primary.timing?.openStartedAt ?? null,
        actualEnd: primary.actualCompletion ?? null,
        durationMinutes: Math.round(
          primary.timing?.elapsedMinutes ?? primary.actualMinutes ?? 0,
        ) || null,
        timing: 'unknown' as const,
        hasProblem: openBlockers.length > 0,
        problemLabel: openBlockers[0]?.reason ?? null,
        primaryTaskId: primary.id,
        parallelGroup: index,
      };
    });
  }

  const depsList = stages.map((s) => ({
    dependsOnCodes: (s.dependsOnCodes ?? s.stageDefinition?.dependsOnCodes ?? []).filter(
      Boolean,
    ) as string[],
    sortOrder: s.sortOrder ?? 0,
  }));
  const groups = parallelGroups(depsList);

  return stages.map((stage, index) => {
    const code = stage.code ?? stage.stageDefinition?.code ?? null;
    const blockers = stage.blockers ?? [];
    const taskWithBlocker = stage.tasks?.find((t) =>
      (t.blockers ?? []).some((b) => !b.resolvedAt),
    );
    const primaryTask =
      stage.tasks?.find((t) => t.status === 'IN_PROGRESS') ??
      stage.tasks?.[0] ??
      null;
    const problemReason =
      blockers[0]?.reason ??
      taskWithBlocker?.blockers?.find((b) => !b.resolvedAt)?.reason ??
      null;

    return {
      key: `${code ?? 'stage'}:${index}`,
      code,
      name: stageDisplayName(stage, locale),
      status: String(stage.status ?? 'PENDING'),
      sortOrder: stage.sortOrder ?? index,
      dependsOnCodes: depsList[index]!.dependsOnCodes,
      assigneeName: assigneeFromStage(stage),
      plannedStart: null,
      plannedEnd: stage.plannedEnd ?? null,
      actualStart: stage.actualStart ?? null,
      actualEnd: stage.actualEnd ?? null,
      durationMinutes: durationMinutes(stage),
      timing: timingForStage(stage),
      hasProblem: blockers.length > 0 || Boolean(taskWithBlocker),
      problemLabel:
        problemReason && !/^[A-Z][A-Z0-9_]{2,}$/.test(problemReason)
          ? problemReason
          : null,
      primaryTaskId: primaryTask?.id ?? null,
      parallelGroup: groups[index] ?? index,
    };
  });
}

export function selectProductionWhereNow(
  order: ProductionOrderDetail,
  locale: string,
  opts: {
    dealerName: string | null;
    productTitle: string;
    imageUrl: string | null;
    deliveryLabel: string | null;
    progressLabel: string | null;
    attentionCount: number;
  },
): ProductionWhereNow {
  const journey = selectProductionJourney(order, locale);
  const completed = journey
    .filter((s) => {
      const st = s.status.toUpperCase();
      return st === 'COMPLETED' || st === 'DONE' || st === 'SKIPPED';
    })
    .map((s) => s.name);
  const waiting = journey
    .filter((s) => {
      const st = s.status.toUpperCase();
      return (
        st === 'PENDING' ||
        st === 'READY' ||
        st === 'WAITING' ||
        st === 'PLANNED' ||
        st === 'NOT_STARTED'
      );
    })
    .map((s) => s.name);
  const active =
    journey.find((s) => s.status.toUpperCase() === 'IN_PROGRESS') ??
    journey.find((s) => s.status.toUpperCase() === 'BLOCKED') ??
    null;

  const currentFromApi = order.currentStage
    ? localizedName(locale, order.currentStage, order.currentStage.code)
    : null;

  let plannedVsActual: ProductionWhereNow['plannedVsActualLabel'] = 'unknown';
  if (!order.actualStartDate) {
    plannedVsActual = 'not_started';
  } else if (order.plannedStartDate && order.actualStartDate) {
    const planned = new Date(order.plannedStartDate).getTime();
    const actual = new Date(order.actualStartDate).getTime();
    if (Number.isFinite(planned) && Number.isFinite(actual)) {
      const day = 24 * 60 * 60 * 1000;
      if (actual <= planned + day && actual >= planned - day) plannedVsActual = 'on_track';
      else if (actual < planned) plannedVsActual = 'ahead';
      else plannedVsActual = 'behind';
    }
  }

  return {
    salesOrderNumber: order.salesOrder?.number ?? null,
    productionOrderNumber: order.number,
    dealerName: opts.dealerName,
    productTitle: opts.productTitle,
    imageUrl: opts.imageUrl,
    currentStageName: currentFromApi || active?.name || null,
    activeWorkerName: active?.assigneeName ?? null,
    completedStageNames: completed,
    waitingStageNames: waiting,
    actualStartDate: order.actualStartDate ?? null,
    plannedStartDate: order.plannedStartDate ?? null,
    plannedVsActualLabel: plannedVsActual,
    deliveryDate: opts.deliveryLabel,
    progressPercent: Number(order.progressPercent ?? 0),
    progressLabel: opts.progressLabel,
    operationalState: String(order.status ?? ''),
    attentionCount: opts.attentionCount,
  };
}

/** Enrich task row with actual bookends from the raw task payload. */
export function enrichTaskExecutionFields(
  row: ProductionTaskRow,
  task: ProductionTask,
): ProductionTaskRow & {
  actualStart: string | null;
  actualEnd: string | null;
  actualMinutes: number | null;
} {
  return {
    ...row,
    actualStart: task.timing?.openStartedAt ?? null,
    actualEnd: task.actualCompletion ?? null,
    actualMinutes: task.actualMinutes ?? task.timing?.actualMinutes ?? null,
  };
}
