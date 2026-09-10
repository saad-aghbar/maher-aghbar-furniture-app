export type { InvoiceCreatableKind, InvoiceCreatableSource } from '@/api/modules/invoices';
import type { InvoiceCreatableKind } from '@/api/modules/invoices';

export function invoiceCreateAction(
  kind: InvoiceCreatableKind,
): 'order' | 'return' | 'purchasing' {
  if (kind === 'RETURN') return 'return';
  if (kind === 'PURCHASING') return 'purchasing';
  return 'order';
}

export function invoiceCreateBlockedKey(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const map: Record<string, string> = {
    INVOICE_EXISTS: 'mobile.invoices.blockedInvoiceExists',
    INVOICE_LINES_NOT_READY: 'mobile.invoices.blockedLinesNotReady',
    RETURN_CHARGE_NOT_CONFIRMED: 'mobile.invoices.blockedReturnNotConfirmed',
    RETURN_CHARGE_NO_AMOUNT: 'mobile.invoices.blockedReturnNoAmount',
    SUPPLIER_INVOICE_NOT_READY: 'mobile.invoices.blockedPurchasingNotReady',
  };
  return map[reason] ?? 'mobile.invoices.blockedGeneric';
}

export function invoiceCreateEmptyKey(kind: InvoiceCreatableKind | 'ALL'): string {
  if (kind === 'ORDER') return 'mobile.invoices.createEmptyOrders';
  if (kind === 'RETURN') return 'mobile.invoices.createEmptyReturns';
  if (kind === 'PURCHASING') return 'mobile.invoices.createEmptyPurchasing';
  return 'mobile.invoices.createEmptyAll';
}
