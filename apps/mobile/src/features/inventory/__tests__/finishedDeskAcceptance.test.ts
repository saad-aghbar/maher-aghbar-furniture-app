import type { FinishedLot } from '@/api/modules/inventory';
import { matchesFgFilter, fgLeaveUrgency } from '../fgFilters';
import { selectFinishedOrders } from '../selectFinishedOrders';

/**
 * Acceptance-shaped fixtures for the Finished Goods outbound desk.
 * These mirror the plan scenarios without requiring a device render.
 */
function lot(
  partial: Partial<FinishedLot> & {
    id: string;
    productNameEn?: string;
    productImageUrl?: string | null;
  },
): FinishedLot {
  const { productNameEn, productImageUrl, ...rest } = partial;
  return {
    id: rest.id,
    quantity: rest.quantity ?? 1,
    producedAt: rest.producedAt ?? '2026-08-01T00:00:00.000Z',
    status: rest.status ?? 'AVAILABLE',
    inventoryItem: {
      id: 'item-1',
      sku: rest.inventoryItem?.sku ?? 'BANQ',
      nameEn: 'Banquette',
      nameAr: 'مقعد',
      product: {
        id: 'p1',
        nameEn: productNameEn ?? 'Banquette Custom',
        nameAr: 'مقعد',
        imageUrl: productImageUrl ?? 'https://cdn.example/banq.jpg',
      },
    },
    warehouse: rest.warehouse ?? {
      id: 'wh-a',
      code: 'FG-A',
      nameEn: 'Finished A',
      nameAr: 'جاهز أ',
    },
    salesOrderNumber: rest.salesOrderNumber ?? 'SO-100',
    salesOrder: rest.salesOrder ?? { id: 'so-100', number: 'SO-100' },
    dealerNameEn: rest.dealerNameEn ?? 'Noor Furnishings',
    dealerNameAr: rest.dealerNameAr ?? 'نور',
    projectName: rest.projectName ?? 'Banquette Custom',
    productionOrderNumber: rest.productionOrderNumber ?? 'PO-9',
    productionOrder: rest.productionOrder ?? {
      id: 'po-9',
      number: 'PO-9',
      productDescription: 'Banquette',
    },
    daysWaiting: rest.daysWaiting ?? 4,
    deliveryStatus: rest.deliveryStatus,
    deliveryDate: rest.deliveryDate,
    deliveryNumber: rest.deliveryNumber,
    packagesPerUnit: rest.packagesPerUnit ?? 6,
    packageCount: rest.packageCount ?? 6,
    pieceLabels: rest.pieceLabels ?? [
      { nameEn: 'Base', nameAr: 'قاعدة' },
      { nameEn: 'Arms', nameAr: 'أذرع' },
      { nameEn: 'Legs', nameAr: 'أرجل' },
    ],
    packageSummary: rest.packageSummary ?? 'Base ×1 · Arms ×2 · Legs ×3',
    loadChecked: rest.loadChecked ?? 0,
    loadTotal: rest.loadTotal ?? 0,
    qrCode: rest.qrCode ?? 'FG-QR-100',
    enteredAt: rest.enteredAt,
    leftAt: rest.leftAt,
  };
}

const boardLots: FinishedLot[] = [
  lot({
    id: 'overdue',
    salesOrder: { id: 'so-over', number: 'SO-OVER' },
    salesOrderNumber: 'SO-OVER',
    productNameEn: 'Sofa Classic',
    productImageUrl: 'https://cdn.example/sofa.jpg',
    dealerNameEn: 'Alpha Dealer',
    deliveryStatus: 'PLANNED',
    deliveryDate: '2026-08-01',
    daysWaiting: 20,
    loadChecked: 2,
    loadTotal: 6,
  }),
  lot({
    id: 'today',
    salesOrder: { id: 'so-today', number: 'SO-TODAY' },
    salesOrderNumber: 'SO-TODAY',
    deliveryStatus: 'READY',
    deliveryDate: new Date().toISOString().slice(0, 10),
    daysWaiting: 2,
  }),
  lot({
    id: 'planned',
    salesOrder: { id: 'so-plan', number: 'SO-PLAN' },
    salesOrderNumber: 'SO-PLAN',
    deliveryStatus: 'PLANNED',
    deliveryDate: '2099-01-15',
    daysWaiting: 1,
  }),
  lot({
    id: 'waiting',
    salesOrder: { id: 'so-wait', number: 'SO-WAIT' },
    salesOrderNumber: 'SO-WAIT',
    deliveryStatus: null,
    deliveryDate: null,
    daysWaiting: 8,
  }),
  lot({
    id: 'split-a',
    salesOrder: { id: 'so-split', number: 'SO-SPLIT' },
    salesOrderNumber: 'SO-SPLIT',
    warehouse: { id: 'wh-a', code: 'FG-A', nameEn: 'Finished A', nameAr: 'أ' },
    deliveryStatus: null,
  }),
  lot({
    id: 'split-b',
    salesOrder: { id: 'so-split', number: 'SO-SPLIT' },
    salesOrderNumber: 'SO-SPLIT',
    warehouse: { id: 'wh-b', code: 'FG-B', nameEn: 'Finished B', nameAr: 'ب' },
    deliveryStatus: null,
  }),
  lot({
    id: 'left',
    salesOrder: { id: 'so-left', number: 'SO-LEFT' },
    salesOrderNumber: 'SO-LEFT',
    status: 'DELIVERED',
    deliveryStatus: 'OUT_FOR_DELIVERY',
    enteredAt: '2026-07-01T00:00:00.000Z',
    leftAt: '2026-08-10T00:00:00.000Z',
  }),
];

describe('Finished Goods desk acceptance scenarios', () => {
  it('shows multiple orders with operational urgency sort', () => {
    const groups = selectFinishedOrders(boardLots, {
      scope: 'inWarehouse',
      fgFilter: 'all',
    });
    const numbers = groups.map((g) => g.salesOrderNumber);
    expect(numbers[0]).toBe('SO-OVER');
    expect(numbers).toContain('SO-TODAY');
    expect(numbers).toContain('SO-WAIT');
    expect(numbers).not.toContain('SO-LEFT');
  });

  it('filters urgency chips and keeps warehouse split badge', () => {
    const overdueOnly = selectFinishedOrders(boardLots, {
      scope: 'inWarehouse',
      fgFilter: 'overdue',
    });
    expect(overdueOnly.every((g) => g.salesOrderNumber === 'SO-OVER')).toBe(true);

    const split = selectFinishedOrders(boardLots, {
      scope: 'inWarehouse',
      fgFilter: 'all',
    }).find((g) => g.salesOrderNumber === 'SO-SPLIT');
    expect(split?.multiWarehouse).toBe(true);
    expect(split?.warehouseIds).toHaveLength(2);
  });

  it('history keeps departed orders with leftAt', () => {
    const history = selectFinishedOrders(boardLots, { scope: 'history' });
    const left = history.find((g) => g.salesOrderNumber === 'SO-LEFT');
    expect(left?.leftAt).toBe('2026-08-10T00:00:00.000Z');
  });

  it('package + leave urgency helpers answer manager questions', () => {
    const overdue = boardLots.find((l) => l.id === 'overdue')!;
    expect(fgLeaveUrgency(overdue)).toBe('overdue');
    expect(matchesFgFilter(overdue, 'leavingToday')).toBe(false);
    expect(overdue.packageSummary).toMatch(/Base/);
    expect(overdue.loadChecked).toBe(2);
    expect(overdue.loadTotal).toBe(6);
  });
});
