import { positiveUnitCost } from '../inventory/issue-unit-cost';
import { roundMoney } from '../../common/helpers/money.util';

export type LaborRateRow = {
  stageDefinitionId?: string | null;
  userId?: string | null;
  hourlyRate: unknown;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
};

export function rateAppliesOn(row: LaborRateRow, at: Date): boolean {
  if (row.effectiveFrom.getTime() > at.getTime()) return false;
  if (row.effectiveTo && row.effectiveTo.getTime() <= at.getTime()) return false;
  return true;
}

function specificity(row: LaborRateRow): number {
  return (row.userId ? 2 : 0) + (row.stageDefinitionId ? 1 : 0);
}

export function resolveHourlyRate(
  rates: LaborRateRow[],
  at: Date,
  match: { stageDefinitionId?: string | null; userId?: string | null },
): number | null {
  const applicable = rates.filter((row) => {
    if (!rateAppliesOn(row, at)) return false;
    if (row.userId && row.userId !== match.userId) return false;
    if (row.stageDefinitionId && row.stageDefinitionId !== match.stageDefinitionId) return false;
    return true;
  });
  applicable.sort((a, b) => {
    const spec = specificity(b) - specificity(a);
    if (spec !== 0) return spec;
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  });
  return positiveUnitCost(applicable[0]?.hourlyRate);
}

export function laborMoneyFromMinutes(minutes: number, hourlyRate: number | null): number | null {
  if (hourlyRate == null || !(minutes > 0)) return null;
  return Number(roundMoney((minutes / 60) * hourlyRate));
}
