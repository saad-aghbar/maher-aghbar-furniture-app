import { describe, expect, it } from 'vitest';
import {
  buildLowStockBatch,
  moveLowStockRow,
  renderWhatsAppTemplate,
  seedExcludedCovered,
  seedLowStockRows,
} from './low-stock-review';

describe('low-stock-review', () => {
  it('groups by supplier and drops excluded rows', () => {
    const rows = seedLowStockRows([
      {
        supplierId: 's1',
        items: [
          { id: 'a', sku: 'A', nameEn: 'Oak', suggestedQty: 4, lastUnitCost: 10 },
          { id: 'b', sku: 'B', nameEn: 'Foam', suggestedQty: 2, lastUnitCost: 5 },
        ],
      },
    ]);
    const moved = moveLowStockRow(rows, 'b', 's2');
    const batch = buildLowStockBatch(moved, new Set(['a']));
    expect(batch).toHaveLength(1);
    expect(batch[0]).toBeDefined();
    expect(batch[0]).toMatchObject({ supplierId: 's2', origin: 'LOW_STOCK' });
    expect(batch[0]?.lines).toHaveLength(1);
  });

  it('passes per-line bin onto the batch payload', () => {
    const rows = seedLowStockRows([
      {
        supplierId: 's1',
        items: [{ id: 'a', sku: 'A', nameEn: 'Oak', suggestedQty: 4, lastUnitCost: 10 }],
      },
    ]).map((row) => ({ ...row, warehouseId: 'wh-1', locationId: 'bin-a' }));
    const batch = buildLowStockBatch(rows, new Set());
    expect(batch[0]?.lines[0]).toMatchObject({
      warehouseId: 'wh-1',
      locationId: 'bin-a',
    });
  });

  it('keeps the catalog SKU on seeded rows', () => {
    const rows = seedLowStockRows([
      {
        supplierId: 's1',
        items: [{ id: 'a', sku: 'MAT-OAK', nameEn: 'Oak', suggestedQty: 4 }],
      },
    ]);
    expect(rows[0]?.sku).toBe('MAT-OAK');
  });

  it('excludes covered rows by default', () => {
    const rows = seedLowStockRows([
      {
        supplierId: 's1',
        items: [
          { id: 'a', sku: 'A', nameEn: 'Oak', suggestedQty: 4, coveredByOpenOrder: true, onOrderQty: 3 },
          { id: 'b', sku: 'B', nameEn: 'Foam', suggestedQty: 2 },
        ],
      },
    ]);
    expect([...seedExcludedCovered(rows)]).toEqual(['a']);
  });

  it('renders WhatsApp tokens and drops unknown ones', () => {
    expect(
      renderWhatsAppTemplate('Hi {{supplierName}} {{missing}}', { supplierName: 'Marka' }),
    ).toBe('Hi Marka ');
  });
});
