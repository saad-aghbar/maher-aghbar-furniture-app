/**
 * Hub list → order destination. Uses the order’s factory state, never the selected lane.
 * Unreleased work opens the plan; anything already on the factory opens the production order.
 */

export type ProductionHubOrderHrefInput = {
  id: string;
  salesOrderId?: string | null;
  releasedToFactoryAt?: string | null;
  originType?: string | null;
};

export function productionHubOrderHref(item: ProductionHubOrderHrefInput): string {
  const soId = item.salesOrderId?.trim() || null;
  const released = Boolean(item.releasedToFactoryAt);
  const returnOrigin =
    item.originType === 'RETURN_WORK' || item.originType === 'REPLACEMENT';

  if (!released && soId) {
    return `/(app)/(admin)/orders/${soId}/production-plan`;
  }
  if (!released && !soId && returnOrigin) {
    return `/(app)/(admin)/production/${item.id}/plan`;
  }
  return `/(app)/(admin)/production/${item.id}`;
}

/** Parent Details: plan if nothing is released, else the first released PO. */
export function productionHubBoardHref(items: ProductionHubOrderHrefInput[]): string {
  const released = items.find((item) => item.releasedToFactoryAt);
  const target = released ?? items[0];
  if (!target) return '/(app)/(admin)/production';
  return productionHubOrderHref(target);
}
