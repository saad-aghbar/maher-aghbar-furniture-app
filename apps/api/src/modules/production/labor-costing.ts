import { laborMoneyFromMinutes, resolveHourlyRate, type LaborRateRow } from '../tasks/labor-rate';
import { calculateDurationMinutes } from '../scheduling/domain/duration-calculator';
import type { DurationEstimateInput } from '../scheduling/domain/types';
import { roundMoney } from '../../common/helpers/money.util';

function money(n: number): number {
  return Number(roundMoney(n));
}

export type LaborTimeEntry = {
  id?: string;
  taskId: string;
  userId: string;
  minutes?: number | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  at?: Date | null;
  isRework?: boolean;
};

export type LaborTaskRef = {
  id: string;
  stageDefinitionId?: string | null;
  stageCode?: string | null;
  isRework?: boolean;
};

export type LaborStageEstimate = DurationEstimateInput & {
  stageDefinitionId: string;
  stageCode?: string | null;
};

export type LaborCostBlock = {
  estimated: number | null;
  actual: number | null;
  byStage: Array<{
    stageDefinitionId: string;
    stageCode: string | null;
    estimated: number | null;
    actual: number | null;
    minutes: number;
  }>;
  byWorker: Array<{
    userId: string;
    minutes: number;
    actual: number | null;
  }>;
};

function entryMinutes(entry: LaborTimeEntry): number {
  if (entry.minutes != null && Number(entry.minutes) > 0) return Number(entry.minutes);
  if (entry.startedAt && entry.endedAt) {
    return Math.max(0, Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000));
  }
  return 0;
}

export function rollupLaborCost(input: {
  entries: LaborTimeEntry[];
  tasks: LaborTaskRef[];
  rates: LaborRateRow[];
  estimates?: LaborStageEstimate[];
  now?: Date;
}): LaborCostBlock | null {
  if (!input.rates.length) return null;

  const now = input.now ?? new Date();
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const stageMinutes = new Map<string, { stageCode: string | null; minutes: number; actual: number }>();
  const workerMinutes = new Map<string, { minutes: number; actual: number; any: boolean }>();
  let actualTotal = 0;
  let actualAny = false;

  for (const entry of input.entries) {
    const minutes = entryMinutes(entry);
    if (!(minutes > 0)) continue;
    const task = taskById.get(entry.taskId);
    const at = entry.endedAt ?? entry.at ?? now;
    const rate = resolveHourlyRate(input.rates, at, {
      userId: entry.userId,
      stageDefinitionId: task?.stageDefinitionId,
    });
    const cost = laborMoneyFromMinutes(minutes, rate);
    const worker = workerMinutes.get(entry.userId) ?? { minutes: 0, actual: 0, any: false };
    worker.minutes += minutes;
    if (cost != null) {
      worker.actual += cost;
      worker.any = true;
      actualTotal += cost;
      actualAny = true;
    }
    workerMinutes.set(entry.userId, worker);

    const stageId = task?.stageDefinitionId ?? 'unknown';
    const stage = stageMinutes.get(stageId) ?? {
      stageCode: task?.stageCode ?? null,
      minutes: 0,
      actual: 0,
    };
    stage.minutes += minutes;
    if (cost != null) stage.actual += cost;
    stageMinutes.set(stageId, stage);
  }

  let estimatedTotal = 0;
  let estimatedAny = false;
  const estimatedByStage = new Map<string, number>();
  for (const estimate of input.estimates ?? []) {
    const minutes = calculateDurationMinutes(estimate);
    if (!(minutes > 0)) continue;
    const rate = resolveHourlyRate(input.rates, now, {
      stageDefinitionId: estimate.stageDefinitionId,
    });
    const cost = laborMoneyFromMinutes(minutes, rate);
    if (cost == null) continue;
    estimatedTotal += cost;
    estimatedAny = true;
    estimatedByStage.set(
      estimate.stageDefinitionId,
      (estimatedByStage.get(estimate.stageDefinitionId) ?? 0) + cost,
    );
    if (!stageMinutes.has(estimate.stageDefinitionId)) {
      stageMinutes.set(estimate.stageDefinitionId, {
        stageCode: estimate.stageCode ?? null,
        minutes,
        actual: 0,
      });
    }
  }

  if (!actualAny && !estimatedAny && stageMinutes.size === 0 && workerMinutes.size === 0) {
    return {
      estimated: null,
      actual: null,
      byStage: [],
      byWorker: [],
    };
  }

  return {
    estimated: estimatedAny ? money(estimatedTotal) : null,
    actual: actualAny ? money(actualTotal) : null,
    byStage: [...stageMinutes.entries()].map(([stageDefinitionId, row]) => ({
      stageDefinitionId,
      stageCode: row.stageCode,
      estimated: estimatedByStage.has(stageDefinitionId)
        ? money(estimatedByStage.get(stageDefinitionId)!)
        : null,
      actual: row.actual > 0 ? money(row.actual) : null,
      minutes: row.minutes,
    })),
    byWorker: [...workerMinutes.entries()].map(([userId, row]) => ({
      userId,
      minutes: row.minutes,
      actual: row.any ? money(row.actual) : null,
    })),
  };
}

export type LaborMoneySummary = {
  actual: number | null;
  pricedMinutes: number;
  unpricedMinutes: number;
  timedMinutes: number;
  reworkActual: number | null;
  reworkMinutes: number;
};

function uniqueEntries(entries: LaborTimeEntry[]): LaborTimeEntry[] {
  const seen = new Set<string>();
  const out: LaborTimeEntry[] = [];
  for (const entry of entries) {
    const key = entry.id || `${entry.taskId}:${entry.userId}:${entry.startedAt?.toISOString?.() ?? ''}:${entry.minutes ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * Actual labor money from posted time entries only — never ProductionTask.actualMinutes.
 * Missing dated rate stays unpriced; today's rate is never applied to old hours without a matching row.
 */
export function summarizeLaborEntries(input: {
  entries: LaborTimeEntry[];
  tasks: LaborTaskRef[];
  rates: LaborRateRow[];
  now?: Date;
}): LaborMoneySummary {
  const now = input.now ?? new Date();
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  let pricedMinutes = 0;
  let unpricedMinutes = 0;
  let pricedMoney = 0;
  let pricedAny = false;
  let reworkMinutes = 0;
  let reworkMoney = 0;
  let reworkAny = false;

  for (const entry of uniqueEntries(input.entries)) {
    const minutes = entryMinutes(entry);
    if (!(minutes > 0)) continue;
    const task = taskById.get(entry.taskId);
    const at = entry.endedAt ?? entry.at ?? now;
    const rate = input.rates.length
      ? resolveHourlyRate(input.rates, at, {
          userId: entry.userId,
          stageDefinitionId: task?.stageDefinitionId,
        })
      : null;
    const cost = laborMoneyFromMinutes(minutes, rate);
    const isRework = entry.isRework === true || task?.isRework === true;
    if (isRework) reworkMinutes += minutes;
    if (cost != null) {
      pricedMinutes += minutes;
      pricedMoney += cost;
      pricedAny = true;
      if (isRework) {
        reworkMoney += cost;
        reworkAny = true;
      }
    } else {
      unpricedMinutes += minutes;
    }
  }

  return {
    actual: pricedAny ? money(pricedMoney) : null,
    pricedMinutes,
    unpricedMinutes,
    timedMinutes: pricedMinutes + unpricedMinutes,
    reworkActual: reworkAny ? money(reworkMoney) : null,
    reworkMinutes,
  };
}
