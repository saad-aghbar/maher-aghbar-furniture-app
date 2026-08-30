import {
  grandTotal,
  lineTotal,
  purchaseLineQtyLabel,
  resolvePurchaseRequestSupplier,
  selectPurchaseCard,
  selectPurchaseRequestCard,
  selectSupplierInvoiceCard,
  warehouseFieldCount,
} from '../selectPurchase';
import type { PurchaseOrder, PurchaseRequest, SupplierInvoice } from '../api';

describe('lineTotal / grandTotal', () => {
  it('computes line and tax totals', () => {
    expect(lineTotal('2', '10')).toBe(20);
    const g = grandTotal([
      {
        key: '1',
        inventoryItemId: 'i1',
        description: 'Fabric',
        unit: 'm',
        quantity: '2',
        unitCost: '10',
      },
    ]);
    expect(g.subtotal).toBe(20);
    expect(g.tax).toBeCloseTo(3.2);
    expect(g.total).toBeCloseTo(23.2);
  });

  it('returns 0 for invalid qty', () => {
    expect(lineTotal('x', '10')).toBe(0);
  });
});

describe('warehouseFieldCount', () => {
  it('is one when a warehouse is present', () => {
    expect(warehouseFieldCount({ id: 'w1', nameEn: 'Raw Materials' })).toBe(1);
    expect(warehouseFieldCount(null)).toBe(0);
  });
});

describe('purchaseLineQtyLabel', () => {
  it('pluralizes block in English, Arabic, and Hebrew', () => {
    expect(purchaseLineQtyLabel('en', 24, 'block')).toBe('24 blocks');
    expect(purchaseLineQtyLabel('en', 1, 'block')).toBe('1 block');
    expect(purchaseLineQtyLabel('ar', 24, 'block')).toBe('24 بلوك');
    expect(purchaseLineQtyLabel('ar', 1, 'block')).toBe('بلوك واحد');
    expect(purchaseLineQtyLabel('ar', 2, 'block')).toBe('بلوكين');
    expect(purchaseLineQtyLabel('ar', 5, 'block')).toBe('5 بلوكات');
    expect(purchaseLineQtyLabel('he', 24, 'block')).toBe('24 בלוקים');
    expect(purchaseLineQtyLabel('he', 1, 'block')).toBe('בלוק אחד');
  });

  it('keeps the backend number and unknown units as-is', () => {
    expect(purchaseLineQtyLabel('en', 24, 'm')).toBe('24 m');
    expect(purchaseLineQtyLabel('en', '24', 'block')).toBe('24 blocks');
  });
});

describe('selectPurchaseCard', () => {
  const po: PurchaseOrder = {
    id: '1',
    number: 'PO-1',
    status: 'SENT',
    total: '100',
    supplierId: 's1',
    warehouseId: 'w1',
    lines: [{ description: 'A', quantity: 1, unitPrice: 100 }],
    supplier: { id: 's1', code: 'S1', name: 'Marka', nameEn: 'Marka Coatings', nameAr: 'ماركا' },
  };

  it('maps supplier by locale and warehouse label', () => {
    expect(selectPurchaseCard(po, 'en', 'Raw Materials').supplierName).toBe('Marka Coatings');
    expect(selectPurchaseCard(po, 'ar').supplierName).toBe('ماركا');
    expect(selectPurchaseCard(po, 'en', 'Raw Materials').lineCount).toBe(1);
    expect(selectPurchaseCard(po, 'en', 'Raw Materials').warehouseLabel).toBe(
      'Raw Materials',
    );
  });
});

describe('selectPurchaseRequestCard', () => {
  const pr: PurchaseRequest = {
    id: 'pr1',
    number: 'PR-1',
    status: 'APPROVED',
    reason: 'Urgent fabric',
    preferredSupplier: {
      id: 's1',
      nameEn: 'Abdali Textile',
      name: 'Abdali',
    },
    offers: [{ id: 'o1', supplierId: 's1', unitPrice: 12 }],
    warehouse: { id: 'w1', nameEn: 'Raw Materials', code: 'RAW' },
    purchaseOrder: { id: 'po1', number: 'PO-BUY-004' },
  };

  it('maps reason, offers, linked PO', () => {
    const card = selectPurchaseRequestCard(pr, 'en');
    expect(card.reason).toBe('Urgent fabric');
    expect(card.offerCount).toBe(1);
    expect(card.linkedPoNumber).toBe('PO-BUY-004');
    expect(card.supplierName).toBe('Abdali Textile');
  });
});

describe('resolvePurchaseRequestSupplier', () => {
  it('prefers selected offer supplier', () => {
    const pr: PurchaseRequest = {
      id: '1',
      number: 'PR',
      status: 'APPROVED',
      preferredSupplier: { id: 'p', nameEn: 'Preferred' },
      offers: [
        {
          id: 'o1',
          supplierId: 's1',
          unitPrice: 1,
          isSelected: true,
          supplier: { id: 's1', nameEn: 'Selected Co' },
        },
      ],
    };
    expect(resolvePurchaseRequestSupplier(pr, 'en')).toBe('Selected Co');
  });
});

describe('selectSupplierInvoiceCard', () => {
  const inv: SupplierInvoice = {
    id: 'si1',
    number: 'SIN-004',
    status: 'PAID',
    supplierId: 's1',
    total: '2347.84',
    paidAmount: '2347.84',
    outstandingAmount: '0',
    dueDate: '2026-06-16T00:00:00.000Z',
    supplier: { id: 's1', code: 'Z', nameEn: 'Zarqa Timber Yard', name: 'Zarqa' },
    purchaseOrder: { id: 'po', number: 'PO-BUY-004' },
  };

  it('maps outstanding and linked PO', () => {
    const card = selectSupplierInvoiceCard(inv, 'en');
    expect(card.linkedPoNumber).toBe('PO-BUY-004');
    expect(card.hasBalance).toBe(false);
    expect(card.supplierName).toBe('Zarqa Timber Yard');
    expect(card.outstanding).toBe(0);
  });
});
