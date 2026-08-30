/**
 * Frontend-only dealer/customer lifecycle vocabulary.
 * Maps backend enums to human lifecycle states without changing domain semantics.
 */

/** Locked starting stage — always present as a root (no predecessors). */
export const OPENING_STAGE_CODE = 'MATERIAL_PREP' as const;
export type OpeningStageCode = typeof OPENING_STAGE_CODE;

export const TERMINAL_STAGE_CODES = ['INSPECTION', 'PACKAGING', 'DELIVERY'] as const;
export type TerminalStageCode = (typeof TERMINAL_STAGE_CODES)[number];

/** Locked anchors: Material Prep + finishing trio. */
export const LOCKED_ANCHOR_STAGE_CODES = [
  OPENING_STAGE_CODE,
  ...TERMINAL_STAGE_CODES,
] as const;
export type LockedAnchorStageCode = (typeof LOCKED_ANCHOR_STAGE_CODES)[number];

export type DealerLifecycleTab =
  | 'all'
  | 'draft'
  | 'waiting'
  | 'needsInformation'
  | 'pending'
  | 'inProduction'
  | 'ready'
  | 'shipped'
  | 'delivered';

export type DealerLifecycleInput = {
  salesOrderStatus?: string | null;
  deliveryStatus?: string | null;
  productionStarted?: boolean;
  isDraft?: boolean;
  /** RFQ status when the hub row is a request (not yet an SO) */
  requestStatus?: string | null;
  productionSetupRequired?: boolean;
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

const PENDING_SO = new Set([
  'CONFIRMED',
  'WAITING_FOR_PAYMENT',
  'ON_HOLD',
  'PENDING',
  'PENDING_APPROVAL',
  'SUBMITTED',
  'OPEN',
]);

/** Post-release factory statuses — dealers see In production (not Preparing). */
const DEALER_IN_PRODUCTION_SO = new Set([
  ...IN_PRODUCTION_SO,
  'READY_FOR_PRODUCTION',
  'WAITING_FOR_MATERIALS',
]);

export function classifyDealerLifecycle(input: DealerLifecycleInput): DealerLifecycleTab {
  const rfq = input.requestStatus?.toUpperCase() ?? '';
  if (input.isDraft || rfq === 'DRAFT' || input.salesOrderStatus?.toUpperCase() === 'DRAFT') {
    // SO DRAFT after accept is production-setup / pending, not a dealer draft RFQ
    if (input.salesOrderStatus?.toUpperCase() === 'DRAFT' && !input.isDraft && rfq !== 'DRAFT') {
      if (input.productionSetupRequired !== false) return 'pending';
    }
    if (input.isDraft || rfq === 'DRAFT') return 'draft';
  }

  if (rfq === 'NEEDS_INFORMATION') return 'needsInformation';
  if (rfq === 'SUBMITTED' || rfq === 'UNDER_REVIEW') return 'waiting';

  const delivery = input.deliveryStatus?.toUpperCase() ?? null;
  const so = input.salesOrderStatus?.toUpperCase() ?? '';

  if (delivery === 'DELIVERED' || DONE_SO.has(so)) return 'delivered';
  if (delivery === 'OUT_FOR_DELIVERY') return 'shipped';
  if (so === 'READY_FOR_DELIVERY' || delivery === 'PLANNED' || delivery === 'READY') return 'ready';
  if (DEALER_IN_PRODUCTION_SO.has(so) || input.productionStarted) return 'inProduction';
  if (PENDING_SO.has(so) || rfq === 'QUOTED' || rfq === 'READY_FOR_QUOTATION' || so === 'DRAFT') {
    return 'pending';
  }
  return 'pending';
}

export function isOpeningStageCode(code: string): code is OpeningStageCode {
  return code === OPENING_STAGE_CODE;
}

export function isTerminalStageCode(code: string): code is TerminalStageCode {
  return (TERMINAL_STAGE_CODES as readonly string[]).includes(code);
}

export function isLockedAnchorStageCode(code: string): code is LockedAnchorStageCode {
  return (LOCKED_ANCHOR_STAGE_CODES as readonly string[]).includes(code);
}

export function isLogisticsStage(code: string, executionKind?: string | null): boolean {
  return executionKind === 'LOGISTICS' || code === 'DELIVERY';
}

export function isConfirmReceiptVisible(deliveryStatus?: string | null): boolean {
  return deliveryStatus?.toUpperCase() === 'OUT_FOR_DELIVERY';
}

export function dealerLifecycleLabelKey(tab: DealerLifecycleTab): string {
  const map: Record<DealerLifecycleTab, string> = {
    all: 'tabs.all',
    draft: 'tabs.draft',
    waiting: 'tabs.waiting',
    needsInformation: 'tabs.needsInformation',
    pending: 'tabs.pending',
    inProduction: 'tabs.inProduction',
    ready: 'tabs.ready',
    shipped: 'tabs.shipped',
    delivered: 'tabs.delivered',
  };
  return map[tab];
}

export function mapConfirmReceiptErrorCode(code?: string | null): string {
  switch (code) {
    case 'DELIVERY_ALREADY_DELIVERED':
      return 'confirmAlreadyDelivered';
    case 'DELIVERY_NOT_OUT_FOR_DELIVERY':
      return 'confirmWrongState';
    case 'NOT_FOUND':
      return 'confirmNotFound';
    default:
      return 'confirmFailed';
  }
}
