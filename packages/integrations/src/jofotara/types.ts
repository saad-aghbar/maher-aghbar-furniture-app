export interface JoFotaraInvoicePayload {
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  customerName?: string;
  customerTaxId?: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    lineTotal: number;
  }>;
  raw?: Record<string, unknown>;
}

export interface JoFotaraClearanceResult {
  uuid: string;
  qr: string;
  status: string;
  clearedAt: Date;
  mock: boolean;
  providerResponse?: unknown;
}

export interface JoFotaraProvider {
  readonly name: string;
  readonly hasCredentials: boolean;
  submitInvoice(payload: JoFotaraInvoicePayload): Promise<JoFotaraClearanceResult>;
}
