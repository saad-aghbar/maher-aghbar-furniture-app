import { Linking, Share } from 'react-native';
import type { PaginatedResponse } from '@maher/types';
import { getAccessToken } from '@/storage/tokens';
import { apiGet, apiPost } from '../client';
import { getApiV1Url } from '../config';
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

/** Fetch statement PDF with Bearer auth and open via data URL / share sheet. */
export async function openStatementPdf(customerId: string): Promise<void> {
  const token = await getAccessToken();
  const url = `${getApiV1Url()}/statements/${encodeURIComponent(customerId)}/pdf`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/pdf',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Statement PDF failed (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  const dataUrl = `data:application/pdf;base64,${arrayBufferToBase64(buf)}`;
  const canOpen = await Linking.canOpenURL(dataUrl);
  if (canOpen) {
    await Linking.openURL(dataUrl);
    return;
  }
  await Share.share({ url: dataUrl, message: 'Account statement PDF' });
}
