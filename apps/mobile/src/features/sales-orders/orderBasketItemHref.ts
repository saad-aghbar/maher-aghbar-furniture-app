import type { Href } from 'expo-router';
import type { AdminOrderLifecycle } from './adminOrderLifecycle';

/**
 * Basket row destination — Preparing opens that line’s plan; later lanes
 * open the linked PO when present, else the sales order.
 */
export function orderBasketItemHref(args: {
  salesOrderId: string;
  lineId: string;
  lifecycle?: AdminOrderLifecycle | null;
  productionOrderId?: string | null;
}): Href {
  const { salesOrderId, lineId, lifecycle, productionOrderId } = args;
  if (lifecycle === 'preparing' || !lifecycle) {
    return `/(app)/(admin)/orders/${salesOrderId}/production-plan?lineId=${lineId}` as Href;
  }
  if (lifecycle === 'in_production' && productionOrderId) {
    return `/(app)/(admin)/production/${productionOrderId}` as Href;
  }
  return `/(app)/(admin)/orders/${salesOrderId}` as Href;
}
