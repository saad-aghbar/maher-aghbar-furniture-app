import { bomReservationNeeds, bomToReadinessInput } from './inventory-reservation.util';

describe('bomReservationNeeds', () => {
  it('prefers SKU material lines over aggregate qty', () => {
    const needs = bomReservationNeeds(
      {
        materials: [{ sku: 'FAB-001', qty: 2.5, category: 'FABRIC' }],
        fabricQty: 99,
      },
      2,
    );
    expect(needs).toEqual([{ sku: 'FAB-001', qty: 5, category: 'FABRIC' }]);
  });

  it('falls back to fabric/wood/foam aggregates when materials are empty', () => {
    const needs = bomReservationNeeds(
      { fabricQty: 3, woodQty: 1, foamQty: 2, accessoriesQty: 0 },
      1,
    );
    expect(needs).toEqual([
      { category: 'FABRIC', qty: 3 },
      { category: 'WOOD', qty: 1 },
      { category: 'FOAM', qty: 2 },
    ]);
  });

  it('maps BOM aggregates to scheduler readiness keys', () => {
    expect(bomToReadinessInput({ fabricQty: 4, woodQty: 1, foamQty: 2 })).toEqual({
      fabricMeters: 4,
      woodUnits: 1,
      foamBlocks: 2,
    });
  });
});
