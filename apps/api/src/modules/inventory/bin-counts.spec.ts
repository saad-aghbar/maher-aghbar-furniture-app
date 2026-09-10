import { InventoryService } from './inventory.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';
import type { PurchasingService } from '../purchasing/purchasing.service';

describe('per-bin stock counts', () => {
  function makeService() {
    const created: Array<{
      lines: { create: Array<{ locationId: string; systemQty: string; countedQty?: string; varianceQty?: string }> };
    }> = [];
    const prisma = {
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ id: 'item-1', archivedAt: null, isActive: true }]),
      },
      warehouseLocation: {
        findFirst: jest.fn().mockImplementation(
          async ({ where }: { where: { id?: string; warehouseId: string; isDefault?: boolean } }) => {
            if (where.id === 'loc-a' && where.warehouseId === 'wh-1') {
              return { id: 'loc-a', warehouseId: 'wh-1' };
            }
            if (where.warehouseId === 'wh-1' && where.isDefault) {
              return {
                id: 'loc-default',
                warehouseId: 'wh-1',
                isDefault: true,
                qrCode: 'BIN-RAW-MAIN',
                code: 'RAW-MAIN',
              };
            }
            return null;
          },
        ),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      inventoryBalance: {
        findFirst: jest.fn().mockImplementation(
          async ({ where }: { where: { locationId?: string } }) => {
            if (where.locationId === 'loc-a') return { availableQty: 7 };
            if (where.locationId === 'loc-default') return { availableQty: 2 };
            return null;
          },
        ),
      },
      inventoryCount: {
        create: jest.fn().mockImplementation(async ({ data }: { data: (typeof created)[number] }) => {
          created.push(data);
          return { id: 'cnt-1', ...data };
        }),
      },
    } as unknown as PrismaService;
    const sequences = { next: jest.fn().mockResolvedValue('CNT-1') } as unknown as SequenceService;
    const purchasing = {} as PurchasingService;
    const service = new InventoryService(prisma, sequences, purchasing);
    return { service, created, prisma };
  }

  it('snapshots system qty from the named bin', async () => {
    const { service, created } = makeService();
    await service.createCount(
      {
        warehouseId: 'wh-1',
        lines: [{ inventoryItemId: 'item-1', countedQty: 5, locationId: 'loc-a' }],
      },
      'u1',
    );
    expect(created[0]?.lines.create[0]).toMatchObject({
      locationId: 'loc-a',
      systemQty: '7.000',
      countedQty: '5.000',
      varianceQty: '-2.000',
    });
  });

  it('falls back to the warehouse default bin when locationId is omitted', async () => {
    const { service, created } = makeService();
    await service.createCount(
      {
        warehouseId: 'wh-1',
        lines: [{ inventoryItemId: 'item-1', countedQty: 4 }],
      },
      'u1',
    );
    expect(created[0]?.lines.create[0]).toMatchObject({
      locationId: 'loc-default',
      systemQty: '2.000',
      countedQty: '4.000',
      varianceQty: '2.000',
    });
  });
});
