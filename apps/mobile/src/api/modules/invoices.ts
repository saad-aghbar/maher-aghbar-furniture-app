import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';
import { openAuthedPdf, withPdfOptions } from '../openPdf';
import type { PdfDownloadOptions } from '@/features/pdf/pdfDownloadTypes';

export type InvoiceLine = {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
};

export type InvoicePayment = {
  id: string;
  number: string;
  amount: number | string;
  method: string;
  paymentDate?: string | null;
  referenceNumber?: string | null;
};

export type Invoice = {
  id: string;
  number: string;
  status: string;
  invoiceDate: string;
  dueDate?: string | null;
  subtotal?: number | string | null;
  taxAmount?: number | string | null;
  taxTotal?: number | string | null;
  discountTotal?: number | string | null;
  total: number | string;
  outstandingAmount?: number | string | null;
  paidAmount?: number | string | null;
  /** Applied to this invoice when the API sends it — not dealer AR. */
  creditAmount?: number | string | null;
  appliedCredit?: number | string | null;
  accountCredit?: number | string | null;
  customerId: string;
  customer?: {
    id: string;
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
    creditLimit?: number | string | null;
  } | null;
  lines?: InvoiceLine[];
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
    title?: string | null;
  } | null;
  payments?: InvoicePayment[];
  jofotaraUuid?: string | null;
  jofotaraQr?: string | null;
  jofotaraStatus?: string | null;
  jofotaraClearedAt?: string | null;
};

export type InvoiceListFilters = PageParams & {
  status?: string;
  q?: string;
  customerId?: string;
};

export async function listInvoices(filters: InvoiceListFilters = {}) {
  const qs = toSearchParams(filters);
  return apiGet<PaginatedResponse<Invoice>>(`/invoices${qs}`);
}

export async function getInvoice(id: string) {
  return apiGet<Invoice>(`/invoices/${encodeURIComponent(id)}`);
}

/** Idempotent ensure — creates or returns existing invoice for the sales order. */
export async function createInvoiceFromSalesOrder(salesOrderId: string) {
  return apiPost<Invoice>('/invoices', { salesOrderId });
}

/** Fetch invoice PDF with Bearer auth and open via data URL / share sheet. */
export async function openInvoicePdf(
  id: string,
  opts?: PdfDownloadOptions,
): Promise<void> {
  await openAuthedPdf(
    withPdfOptions(`/invoices/${encodeURIComponent(id)}/pdf`, opts),
    'Invoice PDF failed',
    'Invoice PDF',
  );
}
