import { Prisma } from '@maher/database';

export function deliveryDealerWarehouseClauses(query: {
  dealerId?: string;
  customerId?: string;
  warehouseId?: string;
}): Prisma.DeliveryWhereInput[] {
  const clauses: Prisma.DeliveryWhereInput[] = [];
  const dealerId = query.dealerId || query.customerId;
  if (dealerId) {
    clauses.push({ customerId: dealerId });
  }
  if (query.warehouseId) {
    clauses.push({
      OR: [
        {
          loadPieces: {
            some: { inventoryLot: { warehouseId: query.warehouseId } },
          },
        },
        {
          salesOrder: {
            inventoryLots: { some: { warehouseId: query.warehouseId } },
          },
        },
      ],
    });
  }
  return clauses;
}
