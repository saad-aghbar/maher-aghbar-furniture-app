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

/** Parent Details: always the sales-order line chooser when an SO exists. */
export function productionHubBoardHref(items: ProductionHubOrderHrefInput[]): string {
  const soId = items.map((item) => item.salesOrderId?.trim()).find(Boolean) ?? null;
  if (soId) {
    return `/(app)/(admin)/orders/${soId}/production-plan`;
  }
  const released = items.find((item) => item.releasedToFactoryAt);
  const target = released ?? items[0];
  if (!target) return '/(app)/(admin)/production';
  return productionHubOrderHref(target);
}

const SO_PLAN = /\/orders\/([^/?]+)\/production-plan/;
const PO_PLAN = /\/production\/([^/?]+)\/plan(?:\?|$)/;
const PO_DETAIL = /\/production\/([^/?]+)(?:\?|$)/;

/**
 * Hub destination → `?selected=` token for the production desk.
 * `so:` = sales-order line chooser. `plan:` = unreleased return-work editor.
 * Bare id = factory order. Null means the stack should still push.
 */
export function productionDeskSelectedId(href: string): string | null {
  const so = href.match(SO_PLAN);
  if (so?.[1]) return `so:${so[1]}`;
  const poPlan = href.match(PO_PLAN);
  if (poPlan?.[1]) return `plan:${poPlan[1]}`;
  if (href.includes('/workflow') || href.includes('/setup')) return null;
  const po = href.match(PO_DETAIL);
  return po?.[1] ?? null;
}

export type ProductionDeskSelection =
  | { kind: 'salesOrder'; id: string }
  | { kind: 'plan'; id: string }
  | { kind: 'factory'; id: string };

export function parseProductionDeskSelection(
  selected: string | undefined,
): ProductionDeskSelection | null {
  if (!selected) return null;
  if (selected.startsWith('so:')) return { kind: 'salesOrder', id: selected.slice(3) };
  if (selected.startsWith('plan:')) return { kind: 'plan', id: selected.slice(5) };
  return { kind: 'factory', id: selected };
}
