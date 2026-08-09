import type { Locale } from '@maher/types';
import { formatDate, formatNumber } from '@/i18n/format';
import type { Invoice, InvoiceLine, InvoicePayment } from './api';

export type InvoiceCardModel = {
  id: string;
  number: string;
  dealerName: string;
  status: string;
  outstanding: number;
  total: number;
  outstandingLabel: string;
  totalLabel: string;
  dueDateLabel: string | null;
  invoiceDateLabel: string;
  factoryOrderNumber: string | null;
  dealerOrderNumber: string | null;
  isOverdue: boolean;
};

export type InvoiceDetailModel = {
  id: string;
  number: string;
  status: string;
  customerId: string;
  dealerName: string;
  factoryOrderNumber: string | null;
  dealerOrderNumber: string | null;
  salesOrderId: string | null;
  invoiceDateLabel: string;
  dueDateLabel: string | null;
  isOverdue: boolean;
  outstanding: number;
  paid: number;
  total: number;
  subtotal: number;
  tax: number;
  lines: Array<{
    id: string;
    description: string;
    quantityLabel: string;
    unitPriceLabel: string;
    lineTotalLabel: string;
  }>;
  payments: Array<{
    id: string;
    number: string;
    amountLabel: string;
    method: string;
    dateLabel: string;
    reference: string | null;
  }>;
  jofotara: {
    submitted: boolean;
    uuid: string | null;
    qr: string | null;
    status: string | null;
    clearedAtLabel: string | null;
  };
};

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

function toNum(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
  return {
    id: inv.id,
    number: inv.number,
    dealerName: dealerNameFor(inv, locale),
    status: inv.status,
    outstanding,
    total,
    outstandingLabel: moneyLabel(locale, outstanding),
    totalLabel: moneyLabel(locale, total),
    dueDateLabel: inv.dueDate ? formatDate(typed, inv.dueDate) : null,
    invoiceDateLabel: inv.invoiceDate ? formatDate(typed, inv.invoiceDate) : '—',
    factoryOrderNumber: inv.salesOrder?.number?.trim() || null,
    dealerOrderNumber: inv.salesOrder?.externalOrderNumber?.trim() || null,
    isOverdue: isOverdueInvoice(inv, outstanding),
  };
}

export function selectInvoiceDetail(inv: Invoice, locale: string): InvoiceDetailModel {
  const typed = asLocale(locale);
  const total = toNum(inv.total);
  const outstanding = toNum(inv.outstandingAmount ?? inv.total);
  const paid = toNum(inv.paidAmount ?? Math.max(0, total - outstanding));
  const tax = toNum(inv.taxAmount ?? inv.taxTotal);
  const subtotal = toNum(inv.subtotal ?? Math.max(0, total - tax));

  const lines = (inv.lines ?? []).map((line: InvoiceLine) => ({
    id: line.id,
    description: line.description?.trim() || '—',
    quantityLabel: formatNumber(typed, toNum(line.quantity), { maximumFractionDigits: 2 }),
    unitPriceLabel: moneyLabel(locale, toNum(line.unitPrice)),
    lineTotalLabel: moneyLabel(locale, toNum(line.lineTotal)),
  }));

  const payments = (inv.payments ?? []).map((p: InvoicePayment) => ({
    id: p.id,
    number: p.number,
    amountLabel: moneyLabel(locale, toNum(p.amount)),
    method: String(p.method ?? ''),
    dateLabel: p.paymentDate ? formatDate(typed, p.paymentDate) : '—',
    reference: p.referenceNumber?.trim() || null,
  }));

  const uuid = inv.jofotaraUuid?.trim() || null;
  const qr = inv.jofotaraQr?.trim() || null;
  const submitted = Boolean(uuid || qr || inv.jofotaraStatus || inv.jofotaraClearedAt);

  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    customerId: inv.customerId,
    dealerName: dealerNameFor(inv, locale),
    factoryOrderNumber: inv.salesOrder?.number?.trim() || null,
    dealerOrderNumber: inv.salesOrder?.externalOrderNumber?.trim() || null,
    salesOrderId: inv.salesOrder?.id ?? null,
    invoiceDateLabel: inv.invoiceDate ? formatDate(typed, inv.invoiceDate) : '—',
    dueDateLabel: inv.dueDate ? formatDate(typed, inv.dueDate) : null,
    isOverdue: isOverdueInvoice(inv, outstanding),
    outstanding,
    paid,
    total,
    subtotal,
    tax,
    lines,
    payments,
    jofotara: {
      submitted,
      uuid,
      qr,
      status: inv.jofotaraStatus?.trim() || null,
      clearedAtLabel: inv.jofotaraClearedAt
        ? formatDate(typed, inv.jofotaraClearedAt)
        : null,
    },
  };
}

/** Dealer ownership: never invent another customer's id into filters. */
export function invoiceListCustomerScope(
  userCustomerId: string | null | undefined,
  requestedCustomerId?: string,
): string | undefined {
  if (userCustomerId) return userCustomerId;
  return requestedCustomerId;
}
