import type { Prisma } from '@maher/database';

export type SupplierInvoiceMaterialKind = 'FABRIC' | 'RAW';

export function fabricPurchaseLineWhere(): Prisma.PurchaseOrderLineWhereInput {
  return {
    OR: [{ fabricProcurementId: { not: null } }, { inventoryItem: { category: 'FABRIC' } }],
  };
}

export function supplierInvoiceMaterialKindWhere(
  kind?: SupplierInvoiceMaterialKind | string | null,
): Prisma.SupplierInvoiceWhereInput {
  if (kind !== 'FABRIC' && kind !== 'RAW') return {};
  const fabricLine = fabricPurchaseLineWhere();
  return {
    purchaseOrder:
      kind === 'FABRIC' ? { lines: { some: fabricLine } } : { lines: { none: fabricLine } },
  };
}
