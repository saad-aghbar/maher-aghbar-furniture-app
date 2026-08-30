import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';
import { openAuthedPdf, withPdfOptions } from '../openPdf';
import type { PdfDownloadOptions } from '@/features/pdf/pdfDownloadTypes';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'OTHER';

export type PaymentAllocation = {
  invoiceId: string;
  amount: number;
};

export type Payment = {
  id: string;
  number: string;
  amount: number | string;
  method: PaymentMethod | string;
  paymentDate: string;
  referenceNumber?: string | null;
  bank?: string | null;
  notes?: string | null;
  customerId?: string;
  invoiceId?: string | null;
  allocatedAmount?: number | string | null;
  unallocatedAmount?: number | string | null;
  customer?: {
    id: string;
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
  } | null;
};

export type StatementEntry = {
  /** Invoice or payment id — used for per-row PDF download. */
  entityId?: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  debit: string;
  credit: string;
  description: string;
  balance: string;
};

export type AccountStatement = {
  customer: { id: string; code: string; name: string };
  asOf: string;
  openingBalance: string | number;
  closingBalance: string | number;
  /** @deprecated prefer amountDue / availableCredit */
  outstandingBalance: string | number;
  amountDue?: number | string;
  availableCredit?: number | string;
  openInvoiceCount?: number;
  overdueAmount?: number | string;
  totalInvoiced: string | number;
  totalPaid: string | number;
  currency: string;
  entries: StatementEntry[];
  payments: Payment[];
};

export type DealerFinanceSummary = {
  amountDue: number;
  availableCredit: number;
  netPosition?: number;
  openInvoiceCount?: number;
  overdueAmount?: number;
  currency: string;
};

export async function listPayments(
  params: PageParams & {
    customerId?: string;
    method?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    customerId: params.customerId,
    method: params.method,
    q: params.q,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  return apiGet<PaginatedResponse<Payment>>(`/payments${qs}`);
}

export async function getDealerFinanceSummary(customerId: string) {
  return apiGet<DealerFinanceSummary>(
    `/payments/dealer/${encodeURIComponent(customerId)}/summary`,
  );
}

export async function recordPayment(body: {
  customerId: string;
  invoiceId?: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  bank?: string;
  notes?: string;
  idempotencyKey?: string;
  allocations?: PaymentAllocation[];
}) {
  return apiPost<Payment>('/payments', body);
}

export async function getStatement(customerId: string) {
  return apiGet<AccountStatement>(`/statements/${encodeURIComponent(customerId)}`);
}

/** Fetch statement PDF with Bearer auth and open via data URL / share sheet. */
export async function openStatementPdf(
  customerId: string,
  opts?: PdfDownloadOptions,
): Promise<void> {
  await openAuthedPdf(
    withPdfOptions(
      `/statements/${encodeURIComponent(customerId)}/pdf`,
      opts,
    ),
    'Statement PDF failed',
    'Account statement PDF',
  );
}

/** Fetch payment receipt PDF with Bearer auth and open via data URL / share sheet. */
export async function openPaymentPdf(
  id: string,
  opts?: PdfDownloadOptions,
): Promise<void> {
  await openAuthedPdf(
    withPdfOptions(`/payments/${encodeURIComponent(id)}/pdf`, opts),
    'Payment PDF failed',
    'Payment receipt PDF',
  );
}
