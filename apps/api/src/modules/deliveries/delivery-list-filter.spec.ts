import { deliveryDealerWarehouseClauses } from './delivery-list-filter';

describe('deliveryDealerWarehouseClauses', () => {
  it('filters by dealer and warehouse', () => {
    const clauses = deliveryDealerWarehouseClauses({
      dealerId: 'cust-1',
      warehouseId: 'wh-1',
    });
    expect(clauses).toEqual(
      expect.arrayContaining([
        { customerId: 'cust-1' },
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              loadPieces: { some: { inventoryLot: { warehouseId: 'wh-1' } } },
            }),
          ]),
        }),
      ]),
    );
  });

  it('is empty without filters', () => {
    expect(deliveryDealerWarehouseClauses({})).toEqual([]);
  });
});
