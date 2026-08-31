/**
 * Order-level manufacturing kind: CUSTOM > MODIFIED > STANDARD.
 */

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
  let worst: OrderManufacturingKind = 'standard';
  for (const raw of complexities) {
    const k = complexityBadgeKey(raw);
    if (k === 'custom') return 'custom';
    if (k === 'modified') worst = 'modified';
  }
  return worst;
}
