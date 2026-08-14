import type { InventoryStockCount, Warehouse, WarehouseTransfer } from '../api';
import {
  countMatchesLifecycle,
  transferMatchesLifecycle,
} from '../selectInventoryOps';

const warehouses: Warehouse[] = [
  { id: 'raw', code: 'RAW', nameEn: 'Raw Materials', nameAr: 'خامات', type: 'RAW_MATERIALS' },
  { id: 'semi', code: 'SEMI', nameEn: 'Semi-Finished', nameAr: 'نصف', type: 'SEMI_FINISHED' },
  { id: 'fin', code: 'FIN', nameEn: 'Finished Goods', nameAr: 'جاهز', type: 'FINISHED_GOODS' },
];

function transfer(
  from: Warehouse,
  to: Warehouse,
  number: string,
): WarehouseTransfer {
  return {
    id: number,
    number,
    status: 'COMPLETED',
    createdAt: '2026-08-14',
    fromWarehouseId: from.id,
    toWarehouseId: to.id,
    fromWarehouse: {
      id: from.id,
      code: from.code,
      nameEn: from.nameEn,
      nameAr: from.nameAr,
      type: from.type,
    },
    toWarehouse: {
      id: to.id,
      code: to.code,
      nameEn: to.nameEn,
      nameAr: to.nameAr,
      type: to.type,
    },
    lines: [],
  };
}

function count(warehouseId: string, number: string): InventoryStockCount {
  return {
    id: number,
    number,
    status: 'DRAFT',
    warehouseId,
    createdAt: '2026-08-14',
    lines: [],
  };
}

describe('transferMatchesLifecycle', () => {
  const rawMove = transfer(warehouses[0]!, warehouses[0]!, 'TRF-RAW');
  const semiMove = transfer(warehouses[1]!, warehouses[1]!, 'TRF-SEMI');
  const fgMove = transfer(warehouses[2]!, warehouses[2]!, 'TRF-FG');

  it('keeps only RAW transfers on Materials', () => {
    expect(transferMatchesLifecycle(rawMove, 'materials')).toBe(true);
    expect(transferMatchesLifecycle(semiMove, 'materials')).toBe(false);
    expect(transferMatchesLifecycle(fgMove, 'materials')).toBe(false);
  });

  it('keeps only SEMI transfers on Semi-finished', () => {
    expect(transferMatchesLifecycle(rawMove, 'semiFinished')).toBe(false);
    expect(transferMatchesLifecycle(semiMove, 'semiFinished')).toBe(true);
    expect(transferMatchesLifecycle(fgMove, 'semiFinished')).toBe(false);
  });

  it('keeps only FG transfers on Finished', () => {
    expect(transferMatchesLifecycle(rawMove, 'finished')).toBe(false);
    expect(transferMatchesLifecycle(semiMove, 'finished')).toBe(false);
    expect(transferMatchesLifecycle(fgMove, 'finished')).toBe(true);
  });
});

describe('countMatchesLifecycle', () => {
  const rawCount = count('raw', 'CNT-RAW');
  const semiCount = count('semi', 'CNT-SEMI');
  const fgCount = count('fin', 'CNT-FG');

  it('keeps only RAW counts on Materials', () => {
    expect(countMatchesLifecycle(rawCount, 'materials', warehouses)).toBe(true);
    expect(countMatchesLifecycle(semiCount, 'materials', warehouses)).toBe(false);
    expect(countMatchesLifecycle(fgCount, 'materials', warehouses)).toBe(false);
  });

  it('keeps only SEMI counts on Semi-finished', () => {
    expect(countMatchesLifecycle(rawCount, 'semiFinished', warehouses)).toBe(false);
    expect(countMatchesLifecycle(semiCount, 'semiFinished', warehouses)).toBe(true);
    expect(countMatchesLifecycle(fgCount, 'semiFinished', warehouses)).toBe(false);
  });

  it('keeps only FG counts on Finished', () => {
    expect(countMatchesLifecycle(rawCount, 'finished', warehouses)).toBe(false);
    expect(countMatchesLifecycle(semiCount, 'finished', warehouses)).toBe(false);
    expect(countMatchesLifecycle(fgCount, 'finished', warehouses)).toBe(true);
  });
});
