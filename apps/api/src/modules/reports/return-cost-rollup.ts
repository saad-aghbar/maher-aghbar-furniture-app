import { positiveUnitCost } from '../inventory/issue-unit-cost';
import { roundMoney } from '../../common/helpers/money.util';

export type ReturnOrigin = 'RETURN_WORK' | 'REPLACEMENT' | 'RETURN_RECOVERY' | string;

export type RecoveryLine = {
  outcome: string;
  quantity: unknown;
  unitCost: unknown;
  postedAt?: Date | null;
};

export function originBucket(originType: ReturnOrigin | null | undefined): 'repair' | 'replacement' | 'recovery' | 'other' {
  if (originType === 'RETURN_WORK') return 'repair';
  if (originType === 'REPLACEMENT') return 'replacement';
  if (originType === 'RETURN_RECOVERY') return 'recovery';
  return 'other';
}

export function recoveryOutcomeValue(lines: RecoveryLine[]) {
  let recoveredValue = 0;
  let disposedValue = 0;
  let recoveredQty = 0;
  let disposedQty = 0;
  let recoveredValuedQty = 0;
  let disposedValuedQty = 0;

  for (const line of lines) {
    if (!line.postedAt) continue;
    const qty = Math.abs(Number(line.quantity) || 0);
    const cost = positiveUnitCost(line.unitCost);
    const outcome = String(line.outcome);
    if (outcome === 'RECOVER_TO_INVENTORY') {
      recoveredQty += qty;
      if (cost != null) {
        recoveredValue += qty * cost;
        recoveredValuedQty += qty;
      }
    } else if (outcome === 'DISPOSE' || outcome === 'DAMAGED') {
      disposedQty += qty;
      if (cost != null) {
        disposedValue += qty * cost;
        disposedValuedQty += qty;
      }
    }
  }

  return {
    recoveredQty,
    disposedQty,
    recoveredValue: recoveredValuedQty > 0 ? Number(roundMoney(recoveredValue)) : null,
    disposedValue: disposedValuedQty > 0 ? Number(roundMoney(disposedValue)) : null,
  };
}

export function lifetimeCost(originalProductionCost: number | null, returnGrossCost: number | null) {
  if (originalProductionCost == null && returnGrossCost == null) return null;
  return Number(roundMoney((originalProductionCost ?? 0) + (returnGrossCost ?? 0)));
}
