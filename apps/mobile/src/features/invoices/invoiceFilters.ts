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

export const INVOICE_DESK_TABS = ['all', 'orders', 'returns', 'purchasing'] as const;
export type InvoiceDeskTab = (typeof INVOICE_DESK_TABS)[number];
export type InvoicePurchasingKind = 'FABRIC' | 'RAW';

export function invoiceDeskTabToKind(tab: InvoiceDeskTab): 'ORDER' | 'RETURN' | undefined {
  if (tab === 'orders') return 'ORDER';
  if (tab === 'returns') return 'RETURN';
  return undefined;
}

export function parseInvoiceDeskTab(raw: string | undefined): InvoiceDeskTab | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'all' || value === 'orders' || value === 'returns' || value === 'purchasing') {
    return value;
  }
  return null;
}

export type InvoicePartySegment = 'dealers' | 'suppliers';

export type InvoicePartySelection = {
  kind: InvoicePartySegment;
  id: string;
  name: string;
};

export function partySegmentsForDesk(desk: InvoiceDeskTab): InvoicePartySegment[] {
  if (desk === 'orders' || desk === 'returns') return ['dealers'];
  if (desk === 'purchasing') return ['suppliers'];
  return ['dealers', 'suppliers'];
}

/** Closed-button copy: All keeps both, Orders/Returns say Dealers, Purchasing says Suppliers. */
export function partyFilterFallbackKey(desk: InvoiceDeskTab): string {
  if (desk === 'orders' || desk === 'returns') return 'mobile.invoices.partyDealers';
  if (desk === 'purchasing') return 'mobile.invoices.partySuppliers';
  return 'mobile.invoices.partyFilter';
}

export function partySelectionAppliesToDesk(
  selection: InvoicePartySelection | null,
  desk: InvoiceDeskTab,
): boolean {
  if (!selection) return true;
  return partySegmentsForDesk(desk).includes(selection.kind);
}

export function invoiceDeskEmptyKeys(
  desk: InvoiceDeskTab,
  purchasingKind?: InvoicePurchasingKind,
): { title: string; body: string } {
  if (desk === 'orders') {
    return { title: 'mobile.invoices.emptyOrdersTitle', body: 'mobile.invoices.emptyOrdersBody' };
  }
  if (desk === 'returns') {
    return { title: 'mobile.invoices.emptyReturnsTitle', body: 'mobile.invoices.emptyReturnsBody' };
  }
  if (desk === 'purchasing') {
    return purchasingKind === 'RAW'
      ? { title: 'mobile.invoices.emptyPurchasingRawTitle', body: 'mobile.invoices.emptyPurchasingRawBody' }
      : { title: 'mobile.invoices.emptyPurchasingFabricTitle', body: 'mobile.invoices.emptyPurchasingFabricBody' };
  }
  return { title: 'mobile.invoices.emptyTitle', body: 'mobile.invoices.emptyBody' };
}

export function splitInvoiceCards<T extends { returnNumber?: string | null }>(cards: T[]) {
  return {
    orders: cards.filter((card) => !card.returnNumber),
    returns: cards.filter((card) => Boolean(card.returnNumber)),
  };
}
