import { PurchaseOrderStatus, ReturnChargeStatus } from '@maher/database';
import { commercialLinesReady, money } from '../payments/dealer-finance';

export const INVOICEABLE_PO_STATUSES: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
  PurchaseOrderStatus.RECEIVED,
  PurchaseOrderStatus.CLOSED,
];

export type InvoiceCreatableKind = 'ORDER' | 'RETURN' | 'PURCHASING';

export type InvoiceCreatableSource = {
  kind: InvoiceCreatableKind;
  id: string;
  number: string;
  title: string;
  partyName: string;
  amount: number;
  status: string;
  imageUrl: string | null;
  blockedReason: string | null;
};

export function partyDisplayName(row: {
  name?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  code?: string | null;
}): string {
  return row.nameEn || row.name || row.nameAr || row.nameHe || row.code || '';
}

export function orderSourceFromRow(row: {
  id: string;
  number: string;
  projectName?: string | null;
  status: string;
  total: unknown;
  customer?: Parameters<typeof partyDisplayName>[0] | null;
  invoices?: Array<{ id: string }>;
  lines?: Array<{
    unitPrice: unknown;
    commercialPriceStatus?: string | null;
    product?: { imageUrl?: string | null } | null;
  }>;
}): InvoiceCreatableSource {
  const hasInvoice = (row.invoices?.length ?? 0) > 0;
  const gate = commercialLinesReady(row.lines ?? []);
  let blockedReason: string | null = null;
  if (hasInvoice) blockedReason = 'INVOICE_EXISTS';
  else if (!gate.ok) blockedReason = 'INVOICE_LINES_NOT_READY';
  return {
    kind: 'ORDER',
    id: row.id,
    number: row.number,
    title: row.projectName || row.number,
    partyName: row.customer ? partyDisplayName(row.customer) : '',
    amount: money(row.total),
    status: row.status,
    imageUrl: row.lines?.find((line) => line.product?.imageUrl)?.product?.imageUrl ?? null,
    blockedReason,
  };
}

export function returnSourceFromRow(row: {
  id: string;
  number: string;
  productDesc?: string | null;
  chargeStatus?: string | null;
  chargeAmount?: unknown;
  customer?: Parameters<typeof partyDisplayName>[0] | null;
  chargeInvoices?: Array<{ id: string }>;
}): InvoiceCreatableSource {
  const hasInvoice = (row.chargeInvoices?.length ?? 0) > 0;
  const amount = money(row.chargeAmount);
  const status = String(row.chargeStatus ?? '');
  let blockedReason: string | null = null;
  if (hasInvoice) blockedReason = 'INVOICE_EXISTS';
  else if (status !== ReturnChargeStatus.CONFIRMED) blockedReason = 'RETURN_CHARGE_NOT_CONFIRMED';
  else if (!(amount > 0)) blockedReason = 'RETURN_CHARGE_NO_AMOUNT';
  return {
    kind: 'RETURN',
    id: row.id,
    number: row.number,
    title: row.productDesc || row.number,
    partyName: row.customer ? partyDisplayName(row.customer) : '',
    amount,
    status,
    imageUrl: null,
    blockedReason,
  };
}

export function purchaseSourceFromRow(row: {
  id: string;
  number: string;
  status: string;
  total: unknown;
  supplier?: Parameters<typeof partyDisplayName>[0] | null;
  supplierInvoices?: Array<{ id: string }>;
}): InvoiceCreatableSource {
  const hasInvoice = (row.supplierInvoices?.length ?? 0) > 0;
  const invoiceable = INVOICEABLE_PO_STATUSES.includes(row.status as PurchaseOrderStatus);
  let blockedReason: string | null = null;
  if (hasInvoice) blockedReason = 'INVOICE_EXISTS';
  else if (!invoiceable) blockedReason = 'SUPPLIER_INVOICE_NOT_READY';
  return {
    kind: 'PURCHASING',
    id: row.id,
    number: row.number,
    title: row.number,
    partyName: row.supplier ? partyDisplayName(row.supplier) : '',
    amount: money(row.total),
    status: row.status,
    imageUrl: null,
    blockedReason,
  };
}

export function paginateSources(
  rows: InvoiceCreatableSource[],
  page: number,
  pageSize: number,
): InvoiceCreatableSource[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
