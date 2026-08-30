import { InventoryService } from './inventory.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';
import type { PurchasingService } from '../purchasing/purchasing.service';

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    inventoryLot: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventoryTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    productionOrderWorkflowSnapshotNode: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    deliveryLoadPiece: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    qualityInspection: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...prismaOverrides,
  } as unknown as PrismaService;

  const sequences = { next: jest.fn() } as unknown as SequenceService;
  const purchasing = {} as PurchasingService;
  const service = new InventoryService(prisma, sequences, purchasing);
  // Traceability enrichment is heavy — stub for board tests
  (service as unknown as { withLotTraceability: (lots: unknown[]) => Promise<unknown[]> }).withLotTraceability =
    async (lots) => lots;
  return { service, prisma };
}

const baseLot = {
  id: 'lot-1',
  quantity: 1,
  producedAt: new Date('2026-08-10T00:00:00.000Z'),
  status: 'AVAILABLE',
  qrCode: 'FG-QR-1',
  warehouseId: 'wh-fg',
  inventoryItemId: 'item-1',
  productionOrderId: 'po-1',
  stageInstanceId: null,
  inventoryItem: {
    id: 'item-1',
    sku: 'BANQ',
    nameEn: 'Banquette',
    nameAr: 'مقعد',
    nameHe: null,
    archivedAt: null,
    itemClass: 'FINISHED_GOOD',
    product: {
      id: 'prod-1',
      nameEn: 'Banquette Custom',
      nameAr: 'مقعد',
      nameHe: null,
      sku: 'BANQ',
      imageUrl: null,
    },
  },
  warehouse: {
    id: 'wh-fg',
    code: 'FG',
    nameEn: 'Finished',
    nameAr: 'جاهز',
    type: 'FINISHED_GOODS',
  },
  location: null,
  productionOrder: { id: 'po-1', number: 'PO-1', productDescription: 'Banquette' },
  salesOrder: {
    id: 'so-1',
    number: 'SO-1',
    projectName: 'Banquette Custom',
    status: 'IN_PRODUCTION',
    customer: {
      id: 'c1',
      nameEn: 'Noor Furnishings',
      nameAr: 'نور',
      nameHe: null,
      name: 'Noor',
      code: 'NOOR',
    },
    deliveries: [
      {
        id: 'del-1',
        number: 'DEL-1',
        status: 'PLANNED',
        deliveryDate: new Date('2026-08-28'),
      },
    ],
  },
  stageInstance: null,
};

describe('listFinishedLots outbound desk', () => {
  it('scopes inWarehouse to AVAILABLE/RESERVED and enriches packages + leave-by', async () => {
    const { service, prisma } = makeService({
      inventoryLot: {
        findMany: jest.fn().mockResolvedValue([baseLot]),
      },
      productionOrderWorkflowSnapshotNode: {
        findMany: jest.fn().mockResolvedValue([
          {
            expectedPieceCount: 3,
            metadata: {
              pieceLabels: [
                { nameEn: 'Base', nameAr: 'قاعدة' },
                { nameEn: 'Arms', nameAr: 'أذرع' },
                { nameEn: 'Legs', nameAr: 'أرجل' },
              ],
            },
            snapshot: { productionOrderId: 'po-1' },
          },
        ]),
      },
      deliveryLoadPiece: {
        findMany: jest.fn().mockResolvedValue([
          { deliveryId: 'del-1', pieceIndex: 1, loadedAt: new Date() },
          { deliveryId: 'del-1', pieceIndex: 2, loadedAt: null },
          { deliveryId: 'del-1', pieceIndex: 3, loadedAt: null },
        ]),
      },
    });

    const result = await service.listFinishedLots({
      scope: 'inWarehouse',
      page: 1,
      pageSize: 20,
    } as never);

    const where = (prisma.inventoryLot.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['AVAILABLE', 'RESERVED'] });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.packageCount).toBe(3);
    expect(result.data[0]!.pieceLabels).toHaveLength(3);
    expect(result.data[0]!.deliveryStatus).toBe('PLANNED');
    expect(result.data[0]!.loadChecked).toBe(1);
    expect(result.data[0]!.loadTotal).toBe(3);
  });

  it('history includes DELIVERED and filters by presence window', async () => {
    const leftLot = {
      ...baseLot,
      id: 'lot-left',
      status: 'DELIVERED',
      producedAt: new Date('2026-07-01T00:00:00.000Z'),
      salesOrder: {
        ...baseLot.salesOrder,
        deliveries: [
          {
            id: 'del-old',
            number: 'DEL-OLD',
            status: 'DELIVERED',
            deliveryDate: new Date('2026-07-15'),
          },
        ],
      },
    };
    const { service, prisma } = makeService({
      inventoryLot: {
        findMany: jest.fn().mockResolvedValue([leftLot]),
      },
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tx1',
            referenceId: 'del-old',
            inventoryItemId: 'item-1',
            createdAt: new Date('2026-07-20T12:00:00.000Z'),
            warehouseId: 'wh-fg',
          },
        ]),
      },
    });

    const result = await service.listFinishedLots({
      scope: 'history',
      from: '2026-07-10',
      to: '2026-07-25',
      page: 1,
      pageSize: 20,
    } as never);

    const where = (prisma.inventoryLot.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.status.in).toContain('DELIVERED');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.leftAt).toBeTruthy();
  });

  it('applies warehouseId and wide q to the prisma where', async () => {
    const { service, prisma } = makeService();
    await service.listFinishedLots({
      scope: 'inWarehouse',
      warehouseId: 'wh-fg',
      q: 'Noor',
      page: 1,
      pageSize: 20,
    } as never);

    const where = (prisma.inventoryLot.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.warehouseId).toBe('wh-fg');
    expect(where.OR?.length).toBeGreaterThan(0);
  });
});
