/**
 * Map a setup-home `?lineId=` (setup line id or sales-order line id)
 * onto the production order that belongs to that line.
 */
export function productionOrderIdForLineId(args: {
  lineId?: string | null;
  productionOrders?: Array<{
    id: string;
    salesOrderLineId?: string | null;
  }>;
  setupLines?: Array<{
    id: string;
    salesOrderLineId: string;
  }>;
  fallbackId?: string | null;
}): string | null {
  const pos = args.productionOrders ?? [];
  const lineId = args.lineId?.trim() || '';
  if (lineId) {
    const bySoLine = pos.find((po) => po.salesOrderLineId === lineId);
    if (bySoLine) return bySoLine.id;
    const setup = (args.setupLines ?? []).find(
      (l) => l.id === lineId || l.salesOrderLineId === lineId,
    );
    if (setup) {
      const bySetup = pos.find((po) => po.salesOrderLineId === setup.salesOrderLineId);
      if (bySetup) return bySetup.id;
    }
  }
  return args.fallbackId ?? pos[0]?.id ?? null;
}
