import {
  applyLowStockDestinationNames,
  buildLowStockBatchPayload,
  lowStockConfirmBlocked,
  lowStockDestinationLabel,
  moveLowStockRow,
  seedLowStockExcluded,
  seedLowStockRows,
  toggleLowStockExcluded,
} from '../lowStockReview';
import type { LowStockDraftResponse } from '@/api/modules/purchasing';

const draft: LowStockDraftResponse = {
  groups: [
    {
      supplierId: 's1',
      supplier: null,
      items: [
        {
          id: 'oak',
          sku: 'OAK',
          nameEn: 'Oak',
          nameAr: 'بلوط',
          unit: 'pcs',
          minStock: 4,
          onHandQty: 1,
          standardCost: 10,
          suggestedQty: 7,
          preferredSupplierId: 's1',
          defaultWarehouseId: 'w1',
          coveredByOpenOrder: true,
          onOrderQty: 4,
          reason: 'LOW_STOCK',
        },
      ],
    },
  ],
  unassigned: {
    supplierId: null,
    supplier: null,
    items: [
      {
        id: 'foam',
        sku: 'FOAM',
        nameEn: 'Foam',
        nameAr: 'فوم',
        unit: 'pcs',
        minStock: 2,
        onHandQty: 0,
        standardCost: 5,
        suggestedQty: 4,
      },
    ],
  },
};

describe('lowStockReview', () => {
  it('prefills suggested qty and groups unassigned separately', () => {
    const rows = seedLowStockRows(draft);
    expect(rows.find((r) => r.itemId === 'oak')?.orderQty).toBe('7');
    expect(rows.find((r) => r.itemId === 'oak')?.onOrderQty).toBe(4);
    expect(rows.find((r) => r.itemId === 'foam')?.supplierId).toBeNull();
    expect([...seedLowStockExcluded(rows)]).toEqual(['oak']);
  });

  it('moves a row between suppliers and drops excluded from payload', () => {
    const moved = moveLowStockRow(seedLowStockRows(draft), 'foam', 's2');
    const excluded = toggleLowStockExcluded(new Set(), 'oak');
    const payload = buildLowStockBatchPayload(moved, excluded);
    expect(payload).toHaveLength(1);
    expect(payload[0].supplierId).toBe('s2');
    expect(payload[0].lines.map((l) => l.inventoryItemId)).toEqual(['foam']);
  });

  it('blocks confirm while unassigned rows remain', () => {
    expect(lowStockConfirmBlocked(seedLowStockRows(draft), new Set())).toBe('unassigned');
    const withBins = seedLowStockRows(draft).map((row) =>
      row.itemId === 'oak' ? { ...row, locationId: 'loc-1' } : row,
    );
    expect(lowStockConfirmBlocked(withBins, new Set(['foam']))).toBeNull();
    expect(lowStockConfirmBlocked(seedLowStockRows(draft), new Set(['foam']))).toBe('holding');
  });

  it('resolves warehouse and holding names onto the row', () => {
    const [named] = applyLowStockDestinationNames(
      [
        {
          ...seedLowStockRows(draft)[0]!,
          warehouseId: 'w-hold',
          locationId: 'loc-1',
          isFabric: true,
        },
      ],
      [
        {
          id: 'w-hold',
          nameEn: 'Raw holds',
          locations: [{ id: 'loc-1', name: 'Front bay' }],
        },
      ],
      'en',
    );
    expect(lowStockDestinationLabel(named!)).toBe('Raw holds · \u2066Front bay\u2069');
    expect(named?.warehouseName).toBe('Raw holds');
    expect(
      lowStockDestinationLabel({
        ...named!,
        isFabric: false,
        warehouseName: 'Raw Materials',
        locationName: 'Front bay',
      }),
    ).toBe('Raw Materials · \u2066Front bay\u2069');
    const warehouses = [
      {
        id: 'w-hold',
        nameEn: 'Raw holds',
        locations: [{ id: 'loc-1', name: 'Front bay' }],
      },
    ];
    const namedRows = [named!];
    expect(applyLowStockDestinationNames(namedRows, warehouses, 'en')).toBe(namedRows);
  });
});
