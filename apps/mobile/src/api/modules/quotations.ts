import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';
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
  manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM';
};

export type CreateQuotationInput = {
  customerId: string;
  requestId?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  offeredDeliveryDate?: string;
  customerNotes?: string;
  internalNotes?: string;
  lines: CreateQuotationLineInput[];
};

export type UpdateQuotationInput = {
  paymentTerms?: string;
  deliveryTerms?: string;
  offeredDeliveryDate?: string;
  customerNotes?: string;
  internalNotes?: string;
  expirationDate?: string;
  lines?: CreateQuotationLineInput[];
};

export type QuotationSummary = {
  id: string;
  number: string;
  status: string;
  version?: number;
  total?: number | string | null;
  commerciallyExpired?: boolean;
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
  discountValue?: number | string | null;
  manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM' | string | null;
  priceRequired?: boolean;
  referenceUnitPrice?: number | string | null;
  product?: {
    id: string;
    sku?: string | null;
    imageUrl?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
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
  offeredDeliveryDate?: string | null;
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
    documents?: Array<{
      id: string;
      fileName: string;
      mimeType?: string | null;
      visibility?: string | null;
    }>;
  } | null;
  lines?: QuotationLine[];
  salesOrders?: Array<{ id: string; number: string; status: string }>;
  acceptedBy?: { id: string; firstName?: string; lastName?: string } | null;
  acceptedAt?: string | null;
  discountTotal?: number | string | null;
  expirationDate?: string | null;
  commerciallyExpired?: boolean;
  canDecide?: boolean;
  rejectionReason?: string | null;
};

export async function listQuotations(
  params: PageParams & { status?: string; q?: string } = {},
): Promise<PaginatedResponse<QuotationSummary & { total?: number | string; version?: number }>> {
  return apiGet(`/quotations${toSearchParams(params)}`);
}

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

export async function requestQuotationRevision(
  id: string,
  comment?: string,
): Promise<QuotationDetail> {
  return apiPost<QuotationDetail>(`/quotations/${encodeURIComponent(id)}/request-revision`, {
    comment,
  });
}

export async function reviseQuotation(id: string): Promise<QuotationSummary> {
  return apiPost<QuotationSummary>(`/quotations/${encodeURIComponent(id)}/revise`);
}

export async function rejectQuotation(id: string, comment?: string): Promise<QuotationDetail> {
  return apiPost<QuotationDetail>(`/quotations/${encodeURIComponent(id)}/reject`, {
    comment,
  });
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
