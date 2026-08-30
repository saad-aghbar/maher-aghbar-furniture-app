import type { FinishedLot } from '@/api/modules/inventory';
import { selectFinishedOrders } from '../selectFinishedOrders';

function lot(overrides: Partial<FinishedLot> & { id: string }): FinishedLot {
  return {
    id: overrides.id,
    quantity: overrides.quantity ?? 1,
    producedAt: overrides.producedAt ?? '2026-08-01T00:00:00.000Z',
    status: overrides.status ?? 'AVAILABLE',
    inventoryItem: overrides.inventoryItem ?? {
      id: 'item-1',
      sku: 'SKU-1',
      nameEn: 'Banquette',
      nameAr: 'مقعد',
      product: {
        id: 'p1',
        nameEn: 'Banquette Custom',
        nameAr: 'مقعد مخصص',
        imageUrl: 'https://example.com/a.jpg',
      },
    },
    warehouse: overrides.warehouse ?? {
      id: 'wh-1',
      code: 'FG',
      nameEn: 'Finished A',
      nameAr: 'جاهز أ',
    },
    salesOrderNumber: overrides.salesOrderNumber ?? 'SO-100',
    salesOrder: overrides.salesOrder ?? {
      id: 'so-1',
      number: 'SO-100',
      projectName: 'Banquette Custom',
    },
    dealerNameEn: overrides.dealerNameEn ?? 'Noor Furnishings',
    dealerNameAr: overrides.dealerNameAr ?? 'نور',
    daysWaiting: overrides.daysWaiting ?? 3,
    deliveryStatus: overrides.deliveryStatus,
    deliveryDate: overrides.deliveryDate,
    packagesPerUnit: overrides.packagesPerUnit ?? 6,
    packageCount: overrides.packageCount ?? 6,
    pieceLabels: overrides.pieceLabels ?? [
      { nameEn: 'Base', nameAr: 'قاعدة' },
      { nameEn: 'Arms', nameAr: 'أذرع' },
    ],
    packageSummary: overrides.packageSummary ?? 'Base ×1 · Arms ×2 · Legs ×3',
    loadChecked: overrides.loadChecked ?? 2,
    loadTotal: overrides.loadTotal ?? 6,
    productionOrderNumber: overrides.productionOrderNumber ?? 'PO-9',
    productionOrder: overrides.productionOrder ?? {
      id: 'po-9',
      number: 'PO-9',
      productDescription: 'Banquette',
    },
    ...overrides,
  };
}

describe('selectFinishedOrders', () => {
  it('groups lots by sales order and marks multi-warehouse', () => {
    const groups = selectFinishedOrders(
      [
        lot({ id: 'l1', warehouse: { id: 'wh-1', code: 'A', nameEn: 'A', nameAr: 'أ' } }),
        lot({
          id: 'l2',
          warehouse: { id: 'wh-2', code: 'B', nameEn: 'B', nameAr: 'ب' },
          packageCount: 3,
        }),
      ],
      { scope: 'inWarehouse', fgFilter: 'all' },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.salesOrderId).toBe('so-1');
    expect(groups[0]!.multiWarehouse).toBe(true);
    expect(groups[0]!.warehouseIds).toHaveLength(2);
    expect(groups[0]!.unitsOnHand).toBe(2);
  });

  it('sorts overdue before waiting', () => {
    const groups = selectFinishedOrders(
      [
        lot({
          id: 'wait',
          salesOrder: { id: 'so-wait', number: 'SO-W' },
          salesOrderNumber: 'SO-W',
          deliveryStatus: null,
          deliveryDate: null,
          daysWaiting: 10,
        }),
        lot({
          id: 'over',
          salesOrder: { id: 'so-over', number: 'SO-O' },
          salesOrderNumber: 'SO-O',
          deliveryStatus: 'PLANNED',
          deliveryDate: '2026-08-01',
          daysWaiting: 2,
        }),
      ],
      { scope: 'inWarehouse', fgFilter: 'all' },
    );
    expect(groups[0]!.salesOrderNumber).toBe('SO-O');
    expect(groups[1]!.salesOrderNumber).toBe('SO-W');
  });

  it('keeps delivered lots in history scope', () => {
    const groups = selectFinishedOrders(
      [
        lot({
          id: 'left',
          status: 'DELIVERED',
          deliveryStatus: 'OUT_FOR_DELIVERY',
          leftAt: '2026-08-20T10:00:00.000Z',
        }),
      ],
      { scope: 'history' },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.leftAt).toBeTruthy();
  });
});
