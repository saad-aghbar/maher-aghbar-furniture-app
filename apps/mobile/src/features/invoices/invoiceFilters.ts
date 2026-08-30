/** Home chips: All / Draft / Open / Partial / Overdue / Paid (API status values). */
export const INVOICE_STATUS_FILTERS = [
  'ALL',
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'OVERDUE',
  'PAID',
] as const;

export type InvoiceStatusFilter = (typeof INVOICE_STATUS_FILTERS)[number];

export type InvoiceDealerOption = {
  id: string;
  name: string;
  /** Short code shown as secondary meta under the name. */
  code?: string | null;
  /** All locale names / codes joined for search. */
  searchText?: string;
};

/** Case-insensitive dealer list filter for the invoices dealer sheet. */
export function filterDealersByQuery(
  dealers: InvoiceDealerOption[],
  query: string,
): InvoiceDealerOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return dealers;
  return dealers.filter((d) => {
    const hay = `${d.name} ${d.searchText ?? ''}`.toLowerCase();
    return hay.includes(needle);
  });
}

export function isInvoiceStatusFilterActive(status: InvoiceStatusFilter): boolean {
  return status !== 'ALL';
}

export function invoiceFilterActiveCount(
  status: InvoiceStatusFilter,
  customerId: string | null,
): number {
  let n = 0;
  if (isInvoiceStatusFilterActive(status)) n += 1;
  if (customerId) n += 1;
  return n;
}
