import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'OTHER';

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
};

export type StatementEntry = {
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
  openingBalance: string;
  closingBalance: string;
  outstandingBalance: string;
  totalInvoiced: string;
  totalPaid: string;
  currency: string;
  entries: StatementEntry[];
  payments: Payment[];
};

export async function listPayments(
  params: PageParams & { customerId?: string; method?: string } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    customerId: params.customerId,
    method: params.method,
  });
  return apiGet<PaginatedResponse<Payment>>(`/payments${qs}`);
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
}) {
  return apiPost<Payment>('/payments', body);
}

export async function getStatement(customerId: string) {
  return apiGet<AccountStatement>(`/statements/${encodeURIComponent(customerId)}`);
}
