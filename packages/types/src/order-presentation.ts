/**
 * Dealer/admin-facing order presentation — maps RFQ + SO + delivery
 * to human lifecycle states without exposing PO/QC/workflow enums.
 */

export type OrderPresentationKey =
  | 'draft'
  | 'waitingForReview'
  | 'needsInformation'
  | 'quotation'
  | 'productionSetup'
  | 'readyForProduction'
  | 'inProduction'
  | 'readyToShip'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'closed';

export type OrderPresentationInput = {
  /** RFQ status when the hub item is a request */
  requestStatus?: string | null;
  /** Sales order status when present */
  salesOrderStatus?: string | null;
  deliveryStatus?: string | null;
  /** True when commercially accepted SO has no production orders yet */
  productionSetupRequired?: boolean;
  /** Linked quote in SENT/VIEWED waiting for dealer */
  hasOpenQuotation?: boolean;
  productionStarted?: boolean;
};

const DONE_SO = new Set([
  'DELIVERED',
  'COMPLETED',
  'INVOICED',
  'CLOSED',
  'CANCELLED',
  'VOID',
]);

const IN_PRODUCTION_SO = new Set([
  'IN_PRODUCTION',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
]);

const READY_PROD_SO = new Set([
  'READY_FOR_PRODUCTION',
  'WAITING_FOR_MATERIALS',
  'WAITING_FOR_PAYMENT',
  'CONFIRMED',
]);

export function mapOrderPresentation(
  input: OrderPresentationInput,
): OrderPresentationKey {
  const so = (input.salesOrderStatus ?? '').toUpperCase();
  const rfq = (input.requestStatus ?? '').toUpperCase();
  const delivery = (input.deliveryStatus ?? '').toUpperCase();

  if (so === 'CANCELLED' || rfq === 'CANCELLED') return 'cancelled';
  if (rfq === 'CLOSED' && !so) return 'closed';

  if (delivery === 'DELIVERED' || DONE_SO.has(so)) return 'delivered';
  if (delivery === 'OUT_FOR_DELIVERY') return 'shipped';
  if (so === 'READY_FOR_DELIVERY' || delivery === 'PLANNED' || delivery === 'READY') {
    return 'readyToShip';
  }
  if (IN_PRODUCTION_SO.has(so) || input.productionStarted) return 'inProduction';
  // Post Piece-2 release: factory owns the order (materials may still be short)
  if (so === 'READY_FOR_PRODUCTION' || so === 'WAITING_FOR_MATERIALS') {
    return 'inProduction';
  }
  if (READY_PROD_SO.has(so)) return 'readyForProduction';

  if (
    input.productionSetupRequired ||
    (so === 'DRAFT' && !input.productionStarted)
  ) {
    // SO draft after accept = production setup; bare RFQ draft is separate
    if (so === 'DRAFT') return 'productionSetup';
  }

  if (rfq === 'DRAFT') return 'draft';
  if (rfq === 'NEEDS_INFORMATION') return 'needsInformation';
  if (rfq === 'SUBMITTED' || rfq === 'UNDER_REVIEW') return 'waitingForReview';
  if (
    rfq === 'QUOTED' ||
    rfq === 'READY_FOR_QUOTATION' ||
    input.hasOpenQuotation
  ) {
    return 'quotation';
  }

  if (so) return 'readyForProduction';
  return 'waitingForReview';
}

/** i18n key under mobile.orders.presentation.* / statuses.presentation.* */
export function orderPresentationLabelKey(key: OrderPresentationKey): string {
  const map: Record<OrderPresentationKey, string> = {
    draft: 'presentation.draft',
    waitingForReview: 'presentation.waitingForReview',
    needsInformation: 'presentation.needsInformation',
    quotation: 'presentation.quotation',
    productionSetup: 'presentation.productionSetup',
    readyForProduction: 'presentation.readyForProduction',
    inProduction: 'presentation.inProduction',
    readyToShip: 'presentation.readyToShip',
    shipped: 'presentation.shipped',
    delivered: 'presentation.delivered',
    cancelled: 'presentation.cancelled',
    closed: 'presentation.closed',
  };
  return map[key];
}

export type RequestStatusGroup =
  | 'drafts'
  | 'waiting_review'
  | 'needs_information'
  | 'quoted'
  | 'closed'
  | 'open_inbox';

/** Maps list filter aliases to Prisma RequestStatus values */
export function requestStatusesForGroup(
  group: RequestStatusGroup | string,
): string[] | null {
  switch (group) {
    case 'drafts':
      return ['DRAFT'];
    case 'waiting_review':
      return ['SUBMITTED', 'UNDER_REVIEW'];
    case 'needs_information':
      return ['NEEDS_INFORMATION'];
    case 'quoted':
      return ['READY_FOR_QUOTATION', 'QUOTED'];
    case 'closed':
      return ['CLOSED', 'CANCELLED'];
    case 'open_inbox':
      return [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'NEEDS_INFORMATION',
        'READY_FOR_QUOTATION',
        'QUOTED',
      ];
    default:
      return null;
  }
}

export type ReviewHistoryEntry = {
  at: string;
  by?: string | null;
  action: string;
  message?: string | null;
};

export function appendReviewHistory(
  existing: unknown,
  entry: ReviewHistoryEntry,
): ReviewHistoryEntry[] {
  const prev = Array.isArray(existing)
    ? (existing as ReviewHistoryEntry[])
    : [];
  return [...prev, entry];
}
