import type { FabricStatusKind } from './selectFabricTracker';

export const FABRIC_ACTIONS = [
  'print',
  'openOrder',
  'openPo',
  'openInvoice',
  'askSupplier',
  'takeFromStock',
  'supplierReplied',
  'wait',
  'redirect',
  'confirmArrival',
  'override',
] as const;

export type FabricActionId = (typeof FABRIC_ACTIONS)[number];

export type FabricSheetKind =
  | 'ask'
  | 'replied'
  | 'wait'
  | 'redirect'
  | 'arrive'
  | 'stock'
  | 'override';

export function fabricActionSet(input: {
  kind: FabricStatusKind;
  storedState?: string | null;
  expectedQty: number | null;
  arrivedQty: number;
  hasLot: boolean;
  purchaseOrderId?: string | null;
  supplierInvoiceId?: string | null;
  salesOrderId?: string | null;
  overridden: boolean;
  canPrint: boolean;
  canOpenOrder: boolean;
  canOpenPo: boolean;
  canManage: boolean;
  canReceive: boolean;
  canOverride: boolean;
}): FabricActionId[] {
  const actions: FabricActionId[] = [];
  if (input.canPrint && input.hasLot) actions.push('print');
  if (input.canOpenOrder && input.salesOrderId) actions.push('openOrder');
  if (input.canOpenPo && input.purchaseOrderId) actions.push('openPo');
  if (input.canOpenPo && input.supplierInvoiceId) actions.push('openInvoice');

  const fullyArrived =
    input.expectedQty != null &&
    input.expectedQty > 0 &&
    input.arrivedQty + 1e-9 >= input.expectedQty;
  const issued = input.kind === 'ISSUED';
  const awaiting =
    input.kind === 'WAITING' ||
    input.storedState === 'AWAITING_SUPPLIER' ||
    input.storedState === 'SUPPLIER_CONFIRMED' ||
    input.storedState === 'DELAYED' ||
    input.storedState === 'PARTIALLY_AVAILABLE';

  if (input.canManage && input.kind === 'NEEDS_ORDERING') {
    actions.push('askSupplier', 'takeFromStock');
  }
  if (input.canManage && (awaiting || input.kind === 'UNAVAILABLE')) {
    actions.push('supplierReplied', 'wait', 'redirect');
  }
  if (input.canManage && input.kind === 'UNAVAILABLE') {
    if (!actions.includes('askSupplier')) actions.push('askSupplier');
  }
  if (input.canReceive && !issued && !fullyArrived) {
    actions.push('confirmArrival');
  }
  if (
    input.canOverride &&
    !input.overridden &&
    input.kind !== 'READY' &&
    input.kind !== 'ISSUED'
  ) {
    actions.push('override');
  }
  return actions;
}

export const SUPPLIER_REPLY_STATES = [
  'SUPPLIER_CONFIRMED',
  'PARTIALLY_AVAILABLE',
  'UNAVAILABLE',
  'READY_FOR_PICKUP',
  'DELAYED',
] as const;

export type SupplierReplyState = (typeof SUPPLIER_REPLY_STATES)[number];
