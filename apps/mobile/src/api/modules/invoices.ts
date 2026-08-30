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

export type InvoicePresentation = {
  phase?: string;
  labelKey?: string;
  tone?: string;
  amountDue?: number;
  paidAmount?: number;
  remaining?: number;
};

export type DealerFinanceSnapshot = {
  amountDue: number;
  availableCredit: number;
  openInvoiceCount?: number;
  overdueAmount?: number;
};

export type ApplyCreditPreview = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceOutstanding: number;
  availableCredit: number;
  applyAmount: number;
  invoiceRemainingAfter: number;
  creditRemainingAfter: number;
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
  total: number | string;
  outstandingAmount?: number | string | null;
  paidAmount?: number | string | null;
  customerId: string;
  customer?: {
    id: string;
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
  } | null;
  lines?: InvoiceLine[];
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
    title?: string | null;
  } | null;
  payments?: InvoicePayment[];
  presentation?: InvoicePresentation | null;
  dealerFinance?: DealerFinanceSnapshot | null;
  jofotaraUuid?: string | null;
  jofotaraQr?: string | null;
  jofotaraStatus?: string | null;
  jofotaraClearedAt?: string | null;
};

export type InvoiceListFilters = PageParams & {
  status?: string;
  q?: string;
  customerId?: string;
  /** When true, server filters overdue; count matches dataset. */
  overdue?: boolean | string;
};

export async function listInvoices(filters: InvoiceListFilters = {}) {
  const qs = toSearchParams(filters);
  return apiGet<PaginatedResponse<Invoice>>(`/invoices${qs}`);
}

export async function getInvoice(id: string) {
  return apiGet<Invoice>(`/invoices/${encodeURIComponent(id)}`);
}

/** Preview applying dealer account credit to an invoice (no mutation). */
export async function previewApplyCredit(invoiceId: string, amount?: number) {
  const qs =
    amount != null && Number.isFinite(amount)
      ? `?amount=${encodeURIComponent(String(amount))}`
      : '';
  return apiGet<ApplyCreditPreview>(
    `/invoices/${encodeURIComponent(invoiceId)}/apply-credit/preview${qs}`,
  );
}

/** Explicitly apply available account credit to an invoice. */
export async function applyCredit(body: {
  invoiceId: string;
  amount?: number;
  idempotencyKey: string;
}) {
  return apiPost<Invoice>(
    `/invoices/${encodeURIComponent(body.invoiceId)}/apply-credit`,
    {
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
    },
  );
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
