import type { BomDefaults } from './order-costing.util';

export type ReservationNeed = {
  sku?: string;
  qty: number;
  category?: string;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Expand a product BOM into reservation lines for `orderLineQty` finished units. */
export function bomReservationNeeds(
  bom: BomDefaults | null | undefined,
  orderLineQty: number,
): ReservationNeed[] {
  const qty = num(orderLineQty) || 1;
  const needs: ReservationNeed[] = [];
  for (const line of bom?.materials ?? []) {
    const lineQty = num(line.qty);
    if (!lineQty) continue;
    needs.push({
      sku: line.sku?.trim() || undefined,
      qty: lineQty * qty,
      category: line.category,
    });
  }
  if (needs.length) return needs;

  const groups: Array<{ qty?: number; category: string }> = [
    { qty: bom?.fabricQty, category: 'FABRIC' },
    { qty: bom?.woodQty, category: 'WOOD' },
    { qty: bom?.foamQty, category: 'FOAM' },
    { qty: bom?.accessoriesQty, category: 'OTHER' },
  ];
  for (const group of groups) {
    const groupQty = num(group.qty);
    if (!groupQty) continue;
    needs.push({ category: group.category, qty: groupQty * qty });
  }
  return needs;
}

export function bomToReadinessInput(bom: BomDefaults | null | undefined) {
  return {
    fabricMeters: num(bom?.fabricQty) || undefined,
    woodUnits: num(bom?.woodQty) || undefined,
    foamBlocks: num(bom?.foamQty) || undefined,
  };
}
