import {
  fabricPurchaseLineWhere,
  supplierInvoiceMaterialKindWhere,
} from './supplier-invoice-material-kind';

describe('supplierInvoiceMaterialKindWhere', () => {
  it('leaves the list unfiltered when kind is omitted', () => {
    expect(supplierInvoiceMaterialKindWhere()).toEqual({});
  });

  it('treats a PO as fabric when a line is linked to fabric procurement or a fabric SKU', () => {
    const fabricLine = fabricPurchaseLineWhere();
    expect(fabricLine).toEqual({
      OR: [{ fabricProcurementId: { not: null } }, { inventoryItem: { category: 'FABRIC' } }],
    });
    expect(supplierInvoiceMaterialKindWhere('FABRIC')).toEqual({
      purchaseOrder: { lines: { some: fabricLine } },
    });
  });

  it('treats everything else as raw-material purchasing', () => {
    expect(supplierInvoiceMaterialKindWhere('RAW')).toEqual({
      purchaseOrder: { lines: { none: fabricPurchaseLineWhere() } },
    });
  });
});
