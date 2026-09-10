import { roundMoney } from '../../common/helpers/money.util';

/** Never invent zero — missing cost stays null. */
export function positiveUnitCost(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number(roundMoney(n));
}

/**
 * Lot cost wins when the movement is tied to a specific lot.
 * SKU map / standard cost is fallback only.
 */
export function resolveIssueUnitCost(parts: {
  lotUnitCost?: unknown;
  mappedUnitCost?: unknown;
  standardCost?: unknown;
}): number | null {
  return (
    positiveUnitCost(parts.lotUnitCost) ??
    positiveUnitCost(parts.mappedUnitCost) ??
    positiveUnitCost(parts.standardCost)
  );
}
