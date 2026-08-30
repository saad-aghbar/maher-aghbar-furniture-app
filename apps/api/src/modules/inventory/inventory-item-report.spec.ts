import {
  buildReportIdentity,
  classifyInventoryItemStockStatus,
  mapInventoryTxType,
} from './inventory-item-report';
import { mapInventoryItemReportToPdfSpec } from './inventory-item-report-pdf';
import type { InventoryItemReportDto } from './inventory-item-report';

describe('inventory item report helpers', () => {
  it('classifies stock status with canonical rules', () => {
    expect(
      classifyInventoryItemStockStatus({ isActive: false, onHand: 10, minStock: 5 }),
    ).toBe('INACTIVE');
    expect(
      classifyInventoryItemStockStatus({ isActive: true, onHand: 0, minStock: 5 }),
    ).toBe('OUT_OF_STOCK');
    expect(
      classifyInventoryItemStockStatus({ isActive: true, onHand: 3, minStock: 5 }),
    ).toBe('LOW_STOCK');
    expect(
      classifyInventoryItemStockStatus({ isActive: true, onHand: 20, minStock: 5 }),
    ).toBe('IN_STOCK');
  });

  it('maps transaction types to report movement kinds', () => {
    expect(mapInventoryTxType('PURCHASE_RECEIPT')).toBe('RECEIPT');
    expect(mapInventoryTxType('PRODUCTION_ISSUE')).toBe('ISSUE');
    expect(mapInventoryTxType('WAREHOUSE_TRANSFER')).toBe('TRANSFER');
    expect(mapInventoryTxType('INVENTORY_ADJUSTMENT')).toBe('ADJUSTMENT');
    expect(mapInventoryTxType('CUSTOMER_RETURN')).toBe('RETURN');
  });

  it('builds identity with scanCode from qrCode/sku invariant', () => {
    const identity = buildReportIdentity({
      id: 'i1',
      sku: 'MAT-ITAL-VEL',
      qrCode: 'MAT-ITAL-VEL',
      barcode: null,
      nameEn: 'Italian Velvet',
      nameAr: 'مخمل إيطالي',
      unit: 'm',
      isActive: true,
      imageUrl: 'https://example.com/a.jpg',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
    });
    expect(identity.scanCode).toBe('MAT-ITAL-VEL');
    expect(identity.sku).toBe('MAT-ITAL-VEL');
    expect(identity.imageUrl).toContain('example.com');
  });
});

describe('mapInventoryItemReportToPdfSpec', () => {
  const baseReport = (): InventoryItemReportDto => ({
    generatedAt: '2026-08-24T10:15:00.000Z',
    locale: 'en',
    identity: {
      id: 'i1',
      sku: 'MAT-ITAL-VEL',
      scanCode: 'MAT-ITAL-VEL',
      barcode: null,
      nameEn: 'Italian Velvet',
      nameAr: 'مخمل إيطالي',
      nameHe: null,
      description: 'Demo fabric',
      category: 'RAW_MATERIAL',
      materialType: 'Fabric',
      color: 'Ivory',
      size: null,
      unit: 'm',
      isActive: true,
      imageUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    stock: {
      onHand: 0,
      reserved: 0,
      available: 0,
      minStock: 10,
      maxStock: null,
      incoming: 24,
      status: 'OUT_OF_STOCK',
    },
    warehouses: [],
    incoming: [
      {
        purchaseOrderId: 'po1',
        purchaseOrderNumber: 'PORD-2026-00019',
        supplierName: 'Fabric Co',
        orderedQty: 24,
        receivedQty: 0,
        remainingQty: 24,
        unit: 'm',
        expectedDeliveryDate: '2026-08-18T00:00:00.000Z',
        status: 'SENT',
      },
    ],
    movements: {
      recent: [],
      totalCount: 0,
      shownCount: 0,
      summary30d: { received: 0, issued: 0, transferred: 0, adjusted: 0, net: 0 },
    },
    counts: null,
    demand: {
      status: 'AT_RISK',
      requiredQty: 8,
      freeQty: 0,
      incomingQty: 24,
      nextRequiredBy: '2026-09-02T00:00:00.000Z',
      nextEta: '2026-08-18T00:00:00.000Z',
      affected: [
        {
          productionOrderNumber: 'PO-2026-00056',
          stageCode: 'UPHOLSTERY',
          qty: 8,
          requiredBy: '2026-09-02T00:00:00.000Z',
        },
      ],
    },
    products: [
      {
        productId: 'p1',
        productName: 'Cedar Italian Velvet Recliner',
        productSku: 'PRD-CEDAR',
        stageCode: 'UPHOLSTERY',
        qtyPerUnit: 8,
        quantityMode: null,
      },
    ],
    productionUsage: null,
    supplier: null,
    cost: { standardCost: 12, stockValue: 0, reservedValue: 0, availableValue: 0 },
    permissions: {
      canViewCost: true,
      canViewIncoming: true,
      canViewDemand: true,
    },
  });

  it('puts scanCode into QR payload and includes report sections', () => {
    const spec = mapInventoryItemReportToPdfSpec({ report: baseReport() });
    expect(spec.scanCode).toBe('MAT-ITAL-VEL');
    expect(spec.itemSku).toBe('MAT-ITAL-VEL');
    expect(spec.reportTitle).toMatch(/Inventory Item Report/i);
    expect(spec.sections.some((s) => /Current stock/i.test(s.title))).toBe(true);
    expect(spec.sections.some((s) => /Incoming/i.test(s.title))).toBe(true);
    expect(spec.sections.some((s) => /Production demand/i.test(s.title))).toBe(true);
    expect(spec.sections.some((s) => /Cost/i.test(s.title))).toBe(true);
  });

  it('omits cost and purchasing sections when permissions deny', () => {
    const report = baseReport();
    report.permissions = {
      canViewCost: false,
      canViewIncoming: false,
      canViewDemand: false,
    };
    report.cost = null;
    report.incoming = null;
    report.demand = null;
    const spec = mapInventoryItemReportToPdfSpec({ report });
    expect(spec.sections.some((s) => /Cost/i.test(s.title))).toBe(false);
    expect(spec.sections.some((s) => /Incoming/i.test(s.title))).toBe(false);
    expect(spec.sections.some((s) => /Production demand/i.test(s.title))).toBe(false);
  });

  it('Arabic locale uses report title تقرير', () => {
    const report = baseReport();
    report.locale = 'ar';
    const spec = mapInventoryItemReportToPdfSpec({ report });
    expect(spec.reportTitle).toContain('تقرير');
    expect(spec.scanHint).toContain('امسح');
  });
});
