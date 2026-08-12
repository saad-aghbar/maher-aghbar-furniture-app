import { apiGet, apiPatch, apiPost } from '../client';
import { openAuthedPdf, withPdfOptions } from '../openPdf';
import type { PdfDownloadOptions } from '@/features/pdf/pdfDownloadTypes';

export type CreateQuotationLineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  productId?: string;
  material?: string;
  fabric?: string;
  color?: string;
  notes?: string;
  taxRate?: number;
  width?: number;
  height?: number;
  depth?: number;
};

export type CreateQuotationInput = {
  customerId: string;
  requestId?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  customerNotes?: string;
  internalNotes?: string;
  lines: CreateQuotationLineInput[];
};

export type UpdateQuotationInput = {
  paymentTerms?: string;
  deliveryTerms?: string;
  customerNotes?: string;
  internalNotes?: string;
  lines?: CreateQuotationLineInput[];
};

export type QuotationSummary = {
  id: string;
  number: string;
  status: string;
};

export type QuotationLine = {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal?: number | string | null;
  unit?: string | null;
  productId?: string | null;
  material?: string | null;
  fabric?: string | null;
  color?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  notes?: string | null;
  taxRate?: number | string | null;
};

export type QuotationDetail = {
  id: string;
  number: string;
  status: string;
  version?: number;
  total?: number | string | null;
  subtotal?: number | string | null;
  taxAmount?: number | string | null;
  taxTotal?: number | string | null;
  currency?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
  pendingApproverRole?: string | null;
  approvalChain?: string[];
  completedApprovalSteps?: string[];
  createdAt?: string;
  customer?: {
    id: string;
    name?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
    code?: string | null;
  } | null;
  request?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
  } | null;
  lines?: QuotationLine[];
  salesOrders?: Array<{ id: string; number: string; status: string }>;
};

export async function createQuotation(
  body: CreateQuotationInput,
): Promise<QuotationSummary> {
  return apiPost<QuotationSummary>('/quotations', body);
}

export async function getQuotation(id: string): Promise<QuotationDetail> {
  return apiGet<QuotationDetail>(`/quotations/${encodeURIComponent(id)}`);
}

export async function updateQuotation(
  id: string,
  body: UpdateQuotationInput,
): Promise<QuotationDetail> {
  return apiPatch<QuotationDetail>(`/quotations/${encodeURIComponent(id)}`, body);
}

export async function submitQuotationForApproval(id: string): Promise<QuotationDetail> {
  return apiPost<QuotationDetail>(
    `/quotations/${encodeURIComponent(id)}/submit-for-approval`,
  );
}

export async function approveQuotation(id: string): Promise<QuotationDetail> {
  return apiPost<QuotationDetail>(`/quotations/${encodeURIComponent(id)}/approve`, {});
}

export async function sendQuotation(id: string): Promise<QuotationDetail> {
  return apiPost<QuotationDetail>(`/quotations/${encodeURIComponent(id)}/send`);
}

export async function acceptQuotation(id: string): Promise<QuotationDetail> {
  return apiPost<QuotationDetail>(`/quotations/${encodeURIComponent(id)}/accept`, {});
}

export async function reviseQuotation(id: string): Promise<QuotationSummary> {
  return apiPost<QuotationSummary>(`/quotations/${encodeURIComponent(id)}/revise`);
}

export async function rejectQuotation(id: string): Promise<QuotationDetail> {
  return apiPost<QuotationDetail>(`/quotations/${encodeURIComponent(id)}/reject`, {});
}

/** Fetch quotation PDF with Bearer auth and open via data URL / share sheet. */
export async function openQuotationPdf(
  id: string,
  opts?: PdfDownloadOptions,
): Promise<void> {
  await openAuthedPdf(
    withPdfOptions(`/quotations/${encodeURIComponent(id)}/pdf`, opts),
    'Quotation PDF failed',
    'Quotation PDF',
  );
}
