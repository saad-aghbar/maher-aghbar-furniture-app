/** Build select/filter options from status enums using the statuses namespace. */
export function statusOptions(
  tStatus: (key: string) => string,
  values: readonly string[],
  includeAll?: { label: string },
): Array<{ value: string; label: string }> {
  const opts = values.map((value) => {
    try {
      return { value, label: tStatus(value) };
    } catch {
      return { value, label: value };
    }
  });
  if (includeAll) {
    return [{ value: '', label: includeAll.label }, ...opts];
  }
  return opts;
}

export const SALES_ORDER_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'READY_FOR_PRODUCTION',
  'IN_PRODUCTION',
  'WAITING_FOR_MATERIALS',
  'WAITING_FOR_PAYMENT',
  'ON_HOLD',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'INVOICED',
  'COMPLETED',
  'CANCELLED',
] as const;

export const QUOTATION_STATUSES = [
  'DRAFT',
  'INTERNAL_REVIEW',
  'APPROVED',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'REVISION_REQUESTED',
  'EXPIRED',
  'CANCELLED',
] as const;

export const REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'READY_FOR_QUOTATION',
  'QUOTED',
  'CLOSED',
  'CANCELLED',
] as const;

export const INVOICE_STATUSES = [
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'VOID',
] as const;

export const PRODUCTION_STATUSES = [
  'DRAFT',
  'PLANNED',
  'WAITING_FOR_MATERIALS',
  'READY',
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
  'CANCELLED',
] as const;

export const TRANSFER_STATUSES = ['DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'] as const;

export const DELIVERY_STATUSES = [
  'PLANNED',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RESCHEDULED',
  'CANCELLED',
] as const;

export const PURCHASE_ORDER_STATUSES = [
  'DRAFT',
  'APPROVED',
  'SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
  'CLOSED',
] as const;

export const PURCHASE_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'ORDERED',
  'CLOSED',
] as const;

export const QUALITY_RESULTS = [
  'PASSED',
  'PASSED_WITH_NOTES',
  'FAILED_REWORK_REQUIRED',
  'BLOCKED',
] as const;

export const CHECKLIST_ITEM_RESULTS = ['PASS', 'FAIL', 'NOT_APPLICABLE'] as const;

export const PRIORITY_STATUSES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
