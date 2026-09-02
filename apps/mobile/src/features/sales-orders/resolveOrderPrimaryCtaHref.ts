import type { Href } from 'expo-router';
import type { JourneyPrimaryCta } from './adminOrderJourney';
import type { AdminOrderLifecycle } from './adminOrderLifecycle';
import type { SalesOrderJourneyLogistics } from '@/api/modules/sales-orders';

/**
 * Stage CTA destination — card button only; card body still opens order detail.
 *
 * Preparing / plan CTAs → Production Plan desk.
 * Ready to start → order detail (View / Edit plan from there).
 * Delivery lanes → load sheet when deliveryId known.
 */
export function resolveOrderPrimaryCtaHref(args: {
  salesOrderId: string;
  lifecycle?: AdminOrderLifecycle | null;
  primaryCta?: JourneyPrimaryCta | null;
  primaryProductionOrderId?: string | null;
  journeyLogistics?: SalesOrderJourneyLogistics | null;
}): Href {
  const {
    salesOrderId,
    lifecycle,
    primaryCta,
    primaryProductionOrderId,
    journeyLogistics,
  } = args;
  const po = primaryProductionOrderId;
  const deliveryId = journeyLogistics?.deliveryId?.trim() || null;

  if (primaryCta === 'review_request') {
    return `/(app)/(admin)/requests/${salesOrderId}` as Href;
  }

  // Preparing → Production Plan desk (one hop from the lane).
  if (
    lifecycle === 'preparing' ||
    primaryCta === 'continue_setup' ||
    primaryCta === 'review_setup' ||
    primaryCta === 'assign_workers' ||
    primaryCta === 'release'
  ) {
    return `/(app)/(admin)/orders/${salesOrderId}/production-plan` as Href;
  }

  if (
    primaryCta === 'edit_plan' ||
    primaryCta === 'open_order' ||
    lifecycle === 'ready_to_start'
  ) {
    return `/(app)/(admin)/orders/${salesOrderId}` as Href;
  }

  if (lifecycle === 'in_production' && po) {
    return `/(app)/(admin)/production/${po}` as Href;
  }
  if (
    (lifecycle === 'ready_to_ship' ||
      lifecycle === 'shipped' ||
      lifecycle === 'delivered') &&
    deliveryId
  ) {
    return `/(app)/(admin)/deliveries/${deliveryId}` as Href;
  }
  if (lifecycle === 'ready_to_ship' || lifecycle === 'shipped') {
    return `/(app)/(admin)/orders/${salesOrderId}` as Href;
  }
  if (po && lifecycle === 'in_production') {
    return `/(app)/(admin)/production/${po}` as Href;
  }
  return `/(app)/(admin)/orders/${salesOrderId}` as Href;
}
