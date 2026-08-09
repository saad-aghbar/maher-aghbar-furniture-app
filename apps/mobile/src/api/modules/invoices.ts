import { Linking, Share } from 'react-native';
import type { PaginatedResponse } from '@maher/types';
import { getAccessToken } from '@/storage/tokens';
import { apiGet, apiPost } from '../client';
import { getApiV1Url } from '../config';
import { toSearchParams, type PageParams } from '../pagination';

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

/** Fetch invoice PDF with Bearer auth and open via data URL / share sheet. */
export async function openInvoicePdf(id: string): Promise<void> {
  const token = await getAccessToken();
  const url = `${getApiV1Url()}/invoices/${encodeURIComponent(id)}/pdf`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/pdf',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Invoice PDF failed (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  const dataUrl = `data:application/pdf;base64,${arrayBufferToBase64(buf)}`;
  const canOpen = await Linking.canOpenURL(dataUrl);
  if (canOpen) {
    await Linking.openURL(dataUrl);
    return;
  }
  await Share.share({ url: dataUrl, message: 'Invoice PDF' });
}
