import type { Href } from 'expo-router';
import type { AdminOrderLifecycle } from './adminOrderLifecycle';

/** Parent Details on an orders card — always the line chooser, never a single job. */
export function orderBasketDetailsHref(salesOrderId: string): Href {
  return `/(app)/(admin)/orders/${salesOrderId}/production-plan` as Href;
}

/**
 * Basket row destination from an orders card.
 *
 * A one-item order still opens the parent chooser (`/production-plan`) so the
 * card never skips into that single line. Multi-item rows may deep-link.
 */
export function orderBasketItemHref(args: {
  salesOrderId: string;
  lineId: string;
  lifecycle?: AdminOrderLifecycle | null;
  productionOrderId?: string | null;
  itemCount?: number | null;
}): Href {
  const { salesOrderId, lineId, lifecycle, productionOrderId, itemCount } = args;
  const chooser = orderBasketDetailsHref(salesOrderId);
  if ((itemCount ?? 0) <= 1) {
    return chooser;
  }
  if (lifecycle === 'preparing' || !lifecycle) {
    return `/(app)/(admin)/orders/${salesOrderId}/production-plan?lineId=${lineId}` as Href;
  }
  if (lifecycle === 'in_production' && productionOrderId) {
    return `/(app)/(admin)/production/${productionOrderId}` as Href;
  }
  return `/(app)/(admin)/orders/${salesOrderId}` as Href;
}
