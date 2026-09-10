import type { Locale } from '@maher/types';
import { formatDate, formatNumber } from '@/i18n/format';
import type { Invoice, InvoiceLine, InvoicePayment } from './api';

export type InvoiceCardModel = {
  id: string;
  number: string;
  dealerName: string;
  status: string;
  outstanding: number;
  paid: number;
  total: number;
  availableCredit: number;
  amountDue: number;
  outstandingLabel: string;
  paidLabel: string;
  totalLabel: string;
  amountDueLabel: string;
  availableCreditLabel: string;
  dueDateLabel: string | null;
  invoiceDateLabel: string;
  factoryOrderNumber: string | null;
  dealerOrderNumber: string | null;
  returnNumber: string | null;
  returnRequestId: string | null;
  isOverdue: boolean;
};

/** Dealer identity chip on invoice detail — full code, or a clean leftover order code. */
export type InvoiceDealerChip = {
  value: string;
  /** Prefix with `accounting.dealerOrderShort` only for a full dealer code. */
  prefixDealer: boolean;
};

export type InvoiceDetailModel = {
  id: string;
  number: string;
  status: string;
  customerId: string;
  dealerName: string;
  factoryOrderNumber: string | null;
  dealerOrderNumber: string | null;
  dealerChip: InvoiceDealerChip | null;
  salesOrderId: string | null;
  returnRequestId: string | null;
  returnNumber: string | null;
  invoiceDateLabel: string;
  dueDateLabel: string | null;
  isOverdue: boolean;
  outstanding: number;
  paid: number;
  credit: number;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  availableCredit: number;
  amountDue: number;
  lines: Array<{
    id: string;
    description: string;
    quantityLabel: string;
    unitPriceLabel: string;
    lineTotalLabel: string;
  }>;
  payments: Array<{
    id: string;
    allocationId?: string;
    number: string;
    amount: number;
    amountLabel: string;
    method: string;
    dateLabel: string;
    reference: string | null;
    kind: 'payment' | 'credit';
  }>;
};

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

function toNum(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hasMoney(v: number | string | null | undefined): boolean {
  if (v == null || v === '') return false;
  return Number.isFinite(Number(v));
}

/** Invoice-record money — 3 dp like the API, not dealer AR. */
function roundMoney(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Credit shown on the invoice board. Dealer-scale figures stay display-only. */
function invoiceCredit(inv: Invoice): number {
  const fromInv = toNum(inv.appliedCredit ?? inv.creditAmount ?? inv.accountCredit);
  if (fromInv > 0) return fromInv;
  return toNum(inv.customer?.creditLimit);
}

/**
 * Remaining due on this invoice: total − paid − invoice-applied credit.
 * Dealer-scale `outstandingAmount` / account credit is display-only and never
 * the hero. A PAID invoice is 0 remaining (matches the Paid pill).
 */
export function invoiceRemainingDue(inv: Invoice): { paid: number; credit: number; outstanding: number } {
  const total = toNum(inv.total);
  const credit = Math.max(0, invoiceCredit(inv));
  const applied = credit <= total + 0.009 ? credit : 0;
  const paidStatus = (inv.status ?? '').toUpperCase() === 'PAID';
  const reportedDue = hasMoney(inv.outstandingAmount) ? toNum(inv.outstandingAmount) : null;
  const dueLooksLikeInvoice = reportedDue != null && reportedDue <= total + 0.009;

  let paid = hasMoney(inv.paidAmount)
    ? toNum(inv.paidAmount)
    : dueLooksLikeInvoice
      ? Math.max(0, total - (reportedDue ?? 0) - applied)
      : 0;

  if (paidStatus) {
    if (paid <= 0.009) paid = total;
    return { paid, credit, outstanding: 0 };
  }

  return {
    paid,
    credit,
    outstanding: Math.max(0, roundMoney(total - paid - applied)),
  };
}

/**
 * Dealer chip value: API dealer code when present; otherwise the dealer
 * order code without a chopped "Dealer {short leftover}" prefix.
 */
export function selectInvoiceDealerChip(inv: Invoice): InvoiceDealerChip | null {
  const code = inv.customer?.code?.trim();
  const orderNo = inv.salesOrder?.externalOrderNumber?.trim();
  if (code) {
    const choppedLeftover = Boolean(orderNo && code === orderNo);
    return { value: code, prefixDealer: !choppedLeftover };
  }
  if (orderNo) return { value: orderNo, prefixDealer: false };
  return null;
}

function moneyLabel(locale: string, value: number): string {
  return formatNumber(asLocale(locale), value, { maximumFractionDigits: 2 });
}

function dealerNameFor(inv: Invoice, locale: string): string {
  const c = inv.customer;
  if (locale === 'ar') return c?.nameAr || c?.nameEn || c?.name || '—';
  if (locale === 'he') return c?.nameHe || c?.nameEn || c?.name || c?.nameAr || '—';
  return c?.nameEn || c?.name || c?.nameAr || '—';
}

export type InvoiceHistoryRow = InvoiceDetailModel['payments'][number];

/** Date · method · reference under a payment history title. */
export function paymentHistoryCaption(
  parts: Array<string | null | undefined>,
): string {
  return parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(' · ');
}

function paymentRow(
  locale: string,
  typed: Locale,
  p: InvoicePayment,
  amount: number,
  kind: 'payment' | 'credit',
  allocationId?: string,
): InvoiceHistoryRow {
  return {
    id: p.id,
    allocationId,
    number: p.number,
    amount,
    amountLabel: moneyLabel(locale, amount),
    method: String(p.method ?? ''),
    dateLabel: p.paymentDate ? formatDate(typed, p.paymentDate) : '—',
    reference: p.referenceNumber?.trim() || null,
    kind,
  };
}

export function selectInvoiceHistory(
  inv: Invoice,
  locale: string,
  typed = asLocale(locale),
): InvoiceDetailModel['payments'] {
  const allocs = inv.allocations ?? [];
  if (allocs.length > 0) {
    return allocs.map((row) => {
      const payment = row.payment;
      const fallback: InvoicePayment = {
        id: row.id,
        number: payment?.number ?? '—',
        amount: row.amount,
        method: payment?.method ?? '',
        paymentDate: payment?.paymentDate,
        referenceNumber: payment?.referenceNumber,
        invoiceId: payment?.invoiceId,
      };
      const source = payment ?? fallback;
      const isCredit = !source.invoiceId || source.invoiceId !== inv.id;
      return paymentRow(
        locale,
        typed,
        source,
        toNum(row.amount),
        isCredit ? 'credit' : 'payment',
        row.id,
      );
    });
  }
  return (inv.payments ?? []).map((p) =>
    paymentRow(locale, typed, p, toNum(p.amount), 'payment'),
  );
}

function isOverdueInvoice(inv: Invoice, outstanding: number): boolean {
  if (outstanding <= 0) return false;
  if ((inv.status ?? '').toUpperCase() === 'OVERDUE') return true;
  if (!inv.dueDate) return false;
  const due = new Date(inv.dueDate).getTime();
  if (!Number.isFinite(due)) return false;
  return due < Date.now();
}

export function selectInvoiceCard(inv: Invoice, locale: string): InvoiceCardModel {
  const typed = asLocale(locale);
  const total = toNum(inv.total);
  const outstanding = toNum(inv.outstandingAmount ?? inv.total);
  const paid = toNum(inv.paidAmount ?? Math.max(0, total - outstanding));
  const amountDue = toNum(inv.dealerFinance?.amountDue ?? outstanding);
  const availableCredit = toNum(inv.dealerFinance?.availableCredit);
  return {
    id: inv.id,
    number: inv.number,
    dealerName: dealerNameFor(inv, locale),
    status: inv.status,
    outstanding,
    paid,
    total,
    availableCredit,
    amountDue,
    outstandingLabel: moneyLabel(locale, outstanding),
    paidLabel: moneyLabel(locale, paid),
    totalLabel: moneyLabel(locale, total),
    amountDueLabel: moneyLabel(locale, amountDue),
    availableCreditLabel: moneyLabel(locale, availableCredit),
    dueDateLabel: inv.dueDate ? formatDate(typed, inv.dueDate) : null,
    invoiceDateLabel: inv.invoiceDate ? formatDate(typed, inv.invoiceDate) : '—',
    factoryOrderNumber: inv.salesOrder?.number?.trim() || null,
    dealerOrderNumber: inv.salesOrder?.externalOrderNumber?.trim() || null,
    returnNumber: inv.returnRequest?.number?.trim() || null,
    returnRequestId: inv.returnRequest?.id ?? inv.returnRequestId ?? null,
    isOverdue: isOverdueInvoice(inv, outstanding),
  };
}

export function selectInvoiceDetail(inv: Invoice, locale: string): InvoiceDetailModel {
  const typed = asLocale(locale);
  const total = toNum(inv.total);
  const { paid, credit, outstanding } = invoiceRemainingDue(inv);
  const tax = toNum(inv.taxAmount ?? inv.taxTotal);
  const subtotal = toNum(inv.subtotal ?? Math.max(0, total - tax));

  const lines = (inv.lines ?? []).map((line: InvoiceLine) => ({
    id: line.id,
    description: line.description?.trim() || '—',
    quantityLabel: formatNumber(typed, toNum(line.quantity), { maximumFractionDigits: 2 }),
    unitPriceLabel: moneyLabel(locale, toNum(line.unitPrice)),
    lineTotalLabel: moneyLabel(locale, toNum(line.lineTotal)),
  }));

  const payments = selectInvoiceHistory(inv, locale, typed);

  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    customerId: inv.customerId,
    dealerName: dealerNameFor(inv, locale),
    factoryOrderNumber: inv.salesOrder?.number?.trim() || null,
    dealerOrderNumber: inv.salesOrder?.externalOrderNumber?.trim() || null,
    dealerChip: selectInvoiceDealerChip(inv),
    salesOrderId: inv.salesOrder?.id ?? null,
    returnRequestId: inv.returnRequest?.id ?? inv.returnRequestId ?? null,
    returnNumber: inv.returnRequest?.number?.trim() || null,
    invoiceDateLabel: inv.invoiceDate ? formatDate(typed, inv.invoiceDate) : '—',
    dueDateLabel: inv.dueDate ? formatDate(typed, inv.dueDate) : null,
    isOverdue: isOverdueInvoice(inv, outstanding),
    outstanding,
    paid,
    credit,
    total,
    subtotal,
    discount: toNum(inv.discountTotal),
    tax,
    availableCredit: toNum(inv.dealerFinance?.availableCredit),
    amountDue: outstanding,
    lines,
    payments,
  };
}

/** Payment for edit/PDF — look on legacy payments and allocation sources. */
export function findInvoicePayment(
  inv: Invoice,
  paymentId: string | null | undefined,
): InvoicePayment | null {
  if (!paymentId) return null;
  const fromPayments = inv.payments?.find((row) => row.id === paymentId);
  if (fromPayments) return fromPayments;
  return inv.allocations?.find((row) => row.payment?.id === paymentId)?.payment ?? null;
}

/** Dealer ownership: never invent another customer's id into filters. */
export function invoiceListCustomerScope(
  userCustomerId: string | null | undefined,
  requestedCustomerId?: string,
): string | undefined {
  if (userCustomerId) return userCustomerId;
  return requestedCustomerId;
}
