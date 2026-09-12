import { positiveUnitCost } from '../inventory/issue-unit-cost';
import { roundMoney } from '../../common/helpers/money.util';
import type { PrismaService } from '../../common/prisma.service';

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

export async function versionHourlyRate(
  prisma: Pick<PrismaService, 'laborRate'>,
  input: { userId: string; hourlyRate?: number | null; actorId?: string | null },
) {
  if (input.hourlyRate === undefined) return;
  const next =
    input.hourlyRate == null || !(Number(input.hourlyRate) > 0) ? null : Number(input.hourlyRate);
  const open = await prisma.laborRate.findFirst({
    where: { userId: input.userId, effectiveTo: null, stageDefinitionId: null },
    orderBy: { effectiveFrom: 'desc' },
  });
  const current = open ? Number(open.hourlyRate) : null;
  if (next == null) {
    if (open) {
      await prisma.laborRate.update({
        where: { id: open.id },
        data: { effectiveTo: new Date() },
      });
    }
    return;
  }
  if (open && current === next) return;
  if (open) {
    await prisma.laborRate.update({
      where: { id: open.id },
      data: { effectiveTo: new Date() },
    });
  }
  await prisma.laborRate.create({
    data: {
      userId: input.userId,
      hourlyRate: next,
      effectiveFrom: new Date(),
      createdById: input.actorId ?? null,
    },
  });
}
