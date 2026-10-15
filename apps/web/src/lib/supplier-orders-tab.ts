const SUPPLIER_TABS = ['open', 'recent', 'history', 'invoices'] as const;
export type SupplierOrdersTab = (typeof SUPPLIER_TABS)[number];

/** Mobile supplier order history lands on the open purchase-order list. */
export function supplierOrdersTab(raw: string | null | undefined): SupplierOrdersTab {
  if (raw === 'orders' || raw === 'open' || raw == null || raw === '') return 'open';
  if (raw === 'recent' || raw === 'history' || raw === 'invoices') return raw;
  return 'open';
}
