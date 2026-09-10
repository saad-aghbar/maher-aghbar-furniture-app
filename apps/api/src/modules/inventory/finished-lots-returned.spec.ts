import { InventoryService } from './inventory.service';
import type { PrismaService } from '../../common/prisma.service';
import { RETURN_QUARANTINE_PREFIX } from '../production/production-origin';

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    inventoryLot: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    productionOrderWorkflowSnapshotNode: { findMany: jest.fn().mockResolvedValue([]) },
    deliveryLoadPiece: { findMany: jest.fn().mockResolvedValue([]) },
    qualityInspection: { findMany: jest.fn().mockResolvedValue([]) },
    returnRequest: { findMany: jest.fn().mockResolvedValue([]) },
    ...prismaOverrides,
  } as unknown as PrismaService;
  const service = new InventoryService(prisma, { next: jest.fn() } as never, {} as never);
  (
    service as unknown as { withLotTraceability: (lots: unknown[]) => Promise<unknown[]> }
  ).withLotTraceability = async (lots) => lots;
  return { service, prisma };
}

describe('listFinishedLots returned origin', () => {
  it('nests origin OR under AND so search OR is not clobbered', async () => {
    const { service, prisma } = makeService();
    await service.listFinishedLots({
      scope: 'inWarehouse',
      origin: 'returned',
      q: 'RET-1',
      page: 1,
      pageSize: 20,
    } as never);

    const where = (prisma.inventoryLot.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR).toBeUndefined();
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { productionOrder: { originType: { in: ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] } } },
            { sourceKey: { startsWith: RETURN_QUARANTINE_PREFIX } },
            { sourceKey: { startsWith: 'return-piece-quarantine:' } },
          ],
        },
        expect.objectContaining({ OR: expect.any(Array) }),
      ]),
    );
  });

  it('excludes return-work and quarantine lots under origin=normal', async () => {
    const { service, prisma } = makeService();
    await service.listFinishedLots({
      scope: 'inWarehouse',
      origin: 'normal',
      page: 1,
      pageSize: 20,
    } as never);
    const where = (prisma.inventoryLot.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({
      NOT: {
        OR: [
          { productionOrder: { originType: { in: ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] } } },
          { sourceKey: { startsWith: RETURN_QUARANTINE_PREFIX } },
          { sourceKey: { startsWith: 'return-piece-quarantine:' } },
        ],
      },
    });
  });

  it('widens history statuses only when origin=returned', async () => {
    const { service, prisma } = makeService();
    await service.listFinishedLots({
      scope: 'history',
      origin: 'returned',
      from: '2026-08-01',
      to: '2026-09-01',
      page: 1,
      pageSize: 20,
    } as never);
    const returnedWhere = (prisma.inventoryLot.findMany as jest.Mock).mock.calls[0][0].where;
    expect(returnedWhere.status.in).toEqual(
      expect.arrayContaining(['SCRAPPED', 'DAMAGED', 'QUARANTINED', 'DELIVERED']),
    );

    await service.listFinishedLots({
      scope: 'history',
      from: '2026-08-01',
      to: '2026-09-01',
      page: 1,
      pageSize: 20,
    } as never);
    const normalHistory = (prisma.inventoryLot.findMany as jest.Mock).mock.calls[1][0].where;
    expect(normalHistory.status.in).toEqual(['AVAILABLE', 'RESERVED', 'DELIVERED']);
  });

  it('projects returnRequest from a quarantine sourceKey', async () => {
    const lot = {
      id: 'lot-q',
      quantity: 1,
      producedAt: new Date('2026-08-10T00:00:00.000Z'),
      status: 'AVAILABLE',
      sourceKey: 'return-quarantine:ret-9',
      warehouseId: 'wh-fg',
      inventoryItemId: 'item-1',
      productionOrderId: null,
      stageInstanceId: null,
      inventoryItem: {
        id: 'item-1',
        sku: 'BANQ',
        nameEn: 'Banquette',
        nameAr: null,
        nameHe: null,
        archivedAt: null,
        itemClass: 'FINISHED_GOOD',
        product: { id: 'p', nameEn: 'Banquette', nameAr: null, nameHe: null, sku: 'BANQ', imageUrl: null },
      },
      warehouse: { id: 'wh-fg', code: 'FG', nameEn: 'Finished', nameAr: null, type: 'FINISHED_GOODS' },
      location: null,
      productionOrder: null,
      salesOrder: null,
      stageInstance: null,
    };
    const { service } = makeService({
      inventoryLot: { findMany: jest.fn().mockResolvedValue([lot]), count: jest.fn().mockResolvedValue(1) },
      returnRequest: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ret-9', number: 'RET-9', lifecycleState: 'RETURNED_TO_STOCK' },
        ]),
      },
    });
    const result = await service.listFinishedLots({
      scope: 'inWarehouse',
      origin: 'returned',
      page: 1,
      pageSize: 20,
    } as never);
    expect(result.data[0]!.returnRequest).toEqual({
      id: 'ret-9',
      number: 'RET-9',
      lifecycleState: 'RETURNED_TO_STOCK',
    });
  });

  it('does not cap return-number search at 50 matches', async () => {
    const { service, prisma } = makeService();
    await service.listFinishedLots({
      scope: 'inWarehouse',
      origin: 'returned',
      q: 'RET-',
      page: 1,
      pageSize: 20,
    } as never);
    expect(prisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { number: { contains: 'RET-', mode: 'insensitive' } },
        select: { id: true },
      }),
    );
    const args = (prisma.returnRequest.findMany as jest.Mock).mock.calls[0][0];
    expect(args.take).toBeUndefined();
  });

  it('history+returned pages without a 500-row fetch cap', async () => {
    const { service, prisma } = makeService({
      inventoryLot: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    });
    await service.listFinishedLots({
      scope: 'history',
      origin: 'returned',
      from: '2026-08-01',
      to: '2026-09-01',
      page: 2,
      pageSize: 20,
    } as never);
    const candidateArgs = (prisma.inventoryLot.findMany as jest.Mock).mock.calls[0][0];
    expect(candidateArgs.take).toBeUndefined();
    expect(candidateArgs.select).toBeDefined();
  });
});
