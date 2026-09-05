/**
 * Order-level manufacturing kind display slugs.
 * Canonical rollup lives in @maher/types (rollupOrderType).
 */

import { rollupOrderType } from '@maher/types';

export type OrderManufacturingKind = 'standard' | 'modified' | 'custom';

export function complexityBadgeKey(
  complexity: string | null | undefined,
): OrderManufacturingKind {
  const c = String(complexity ?? 'STANDARD').toUpperCase();
  if (c === 'MODIFIED') return 'modified';
  if (c === 'CUSTOM') return 'custom';
  return 'standard';
}

/** Worst line complexity wins for multi-line sales orders. */
export function resolveOrderManufacturingKind(
  complexities: Array<string | null | undefined>,
): OrderManufacturingKind {
  return complexityBadgeKey(rollupOrderType(complexities));
}
