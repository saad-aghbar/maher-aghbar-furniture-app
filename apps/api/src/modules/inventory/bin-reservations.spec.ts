import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';
import type { PurchasingService } from '../purchasing/purchasing.service';

describe('bin-pooled reservations', () => {
  function makeService(
    rows: Array<{ id: string; availableQty: number; reservedQty: number; locationId: string | null }>,
  ) {
    const updates: Array<{ id: string; reservedQty: string }> = [];
    const client = {
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue(rows),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: { reservedQty: string } }) => {
          updates.push({ id: where.id, reservedQty: data.reservedQty });
        }),
      },
    };
    const prisma = client as unknown as PrismaService;
    const sequences = { next: jest.fn() } as unknown as SequenceService;
    const purchasing = {} as PurchasingService;
    const service = new InventoryService(prisma, sequences, purchasing);
    return { service, updates, client };
  }

  it('reserves across bins with the most free stock first', async () => {
    const { service, updates } = makeService([
      { id: 'a', availableQty: 10, reservedQty: 0, locationId: 'loc-a' },
      { id: 'b', availableQty: 4, reservedQty: 0, locationId: 'loc-b' },
    ]);
    await service.reserveQty('item-1', 'wh-1', 12, 'u1');
    expect(updates).toEqual([
      { id: 'a', reservedQty: '10.000' },
      { id: 'b', reservedQty: '2.000' },
    ]);
  });

  it('rejects when warehouse-wide free qty is short', async () => {
    const { service } = makeService([
      { id: 'a', availableQty: 3, reservedQty: 1, locationId: 'loc-a' },
    ]);
    await expect(service.reserveQty('item-1', 'wh-1', 3, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('releases reserved qty from the fullest reserved bin first', async () => {
    const { service, updates } = makeService([
      { id: 'b', availableQty: 4, reservedQty: 4, locationId: 'loc-b' },
      { id: 'a', availableQty: 10, reservedQty: 2, locationId: 'loc-a' },
    ]);
    await service.releaseReservation('item-1', 'wh-1', 5);
    expect(updates[0]).toEqual({ id: 'b', reservedQty: '0.000' });
    expect(updates[1]).toEqual({ id: 'a', reservedQty: '1.000' });
  });
});
