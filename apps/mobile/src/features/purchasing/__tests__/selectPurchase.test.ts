import {
  grandTotal,
  lineTotal,
  resolvePurchaseRequestSupplier,
  selectPurchaseCard,
  selectPurchaseDetail,
  selectPurchaseRequestCard,
  selectSupplierInvoiceCard,
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

describe('selectPurchaseDetail', () => {
  const velvet: PurchaseOrder = {
    id: 'po-23',
    number: 'PORD-2026-00023',
    status: 'RECEIVED',
    supplierId: 's-fabric',
    subtotal: '3950',
    taxAmount: '632',
    total: '4582',
    supplier: {
      id: 's-fabric',
      code: 'SUP-FABRIC',
      name: 'Abdali Textile Mill',
      nameEn: 'Abdali Textile Mill',
    },
    lines: [
      {
        id: 'ln-1',
        description: 'Velvet navy roll',
        quantity: '316',
        unit: 'm',
        unitPrice: '12.5',
        lineTotal: '4582',
        inventoryItemId: 'mat-vel-navy',
      },
    ],
    goodsReceipts: [
      {
        id: 'grn-1',
        number: 'GRN-2026-00023',
        receiptDate: '2026-07-21T00:00:00.000Z',
        lines: [
          {
            inventoryItemId: 'mat-vel-navy',
            orderedQty: '316',
            receivedQty: '316',
            rejectedQty: '0',
          },
        ],
      },
    ],
  };

  it('keeps grand tax-inclusive and variance on the net family', () => {
    const detail = selectPurchaseDetail(velvet, 'en');
    expect(detail.supplierName).toBe('Abdali Textile Mill');
    expect(detail.status).toBe('RECEIVED');
    expect(detail.grandTotalInclTax).toBe(4582);
    expect(detail.expectedNet).toBe(3950);
    expect(detail.actualReceivedNet).toBe(3950);
    expect(detail.varianceNet).toBe(0);
    expect(detail.remainingQty).toBe(0);
    expect(detail.receivedPercent).toBe(100);
    expect(detail.lines[0]).toMatchObject({
      description: 'Velvet navy roll',
      quantity: 316,
      unit: 'm',
      unitPrice: 12.5,
      receivedQty: 316,
      remainingQty: 0,
    });
    expect(detail.receipts).toHaveLength(1);
    expect(detail.receipts[0].number).toBe('GRN-2026-00023');
  });

  it('does not treat tax-inclusive lineTotal as expected net', () => {
    const detail = selectPurchaseDetail(
      { ...velvet, subtotal: undefined, total: '4582' },
      'en',
    );
    expect(detail.expectedNet).toBe(3950);
    expect(detail.grandTotalInclTax).toBe(4582);
    expect(detail.varianceNet).toBe(0);
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
