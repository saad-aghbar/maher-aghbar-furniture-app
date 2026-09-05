import { WarehouseType } from '@maher/database';
import { RawMaterialsReportService } from './raw-materials-report.service';
import { RAW_MATERIALS_COST_BASIS_ID } from './raw-materials-report';
import type { AuthUser } from '@maher/types';
import type { PrismaService } from '../../common/prisma.service';
import type { PurchasingService } from '../purchasing/purchasing.service';

const user: AuthUser = {
  id: 'u1',
  username: 'admin',
  email: 'admin@example.com',
  name: 'Ada Min',
  firstName: 'Ada',
  lastName: 'Min',
  roles: ['ADMIN'],
  permissions: ['report.inventory.read', 'inventory.cost.read'],
  preferredLanguage: 'en',
};

const item = {
  id: 'i1',
  sku: 'FAB-1',
  nameEn: 'Velvet',
  nameAr: 'مخمل',
  nameHe: null,
  category: 'FABRIC',
  unit: 'm',
  minStock: 5,
  standardCost: 10,
  isActive: true,
};

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    factoryCalendar: {
      findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }),
    },
    warehouse: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'wh-a', code: 'RAW-A', nameEn: 'Raw A', nameAr: 'خام أ', nameHe: null },
        { id: 'wh-b', code: 'RAW-B', nameEn: 'Raw B', nameAr: 'خام ب', nameHe: null },
      ]),
    },
    inventoryItem: {
      findMany: jest.fn().mockResolvedValue([item]),
    },
    inventoryBalance: {
      groupBy: jest.fn().mockResolvedValue([
        { inventoryItemId: 'i1', warehouseId: 'wh-a', _sum: { availableQty: 20, reservedQty: 2 } },
        { inventoryItemId: 'i1', warehouseId: 'wh-b', _sum: { availableQty: 20, reservedQty: 0 } },
      ]),
    },
    inventoryTransaction: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    goodsReceipt: { findMany: jest.fn().mockResolvedValue([]) },
    productionTask: { findMany: jest.fn().mockResolvedValue([]) },
    productionOrder: { findMany: jest.fn().mockResolvedValue([]) },
    productionTaskMaterialUsage: { findMany: jest.fn().mockResolvedValue([]) },
    warehouseTransfer: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryCount: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
  const purchasing = {
    materialDemand: jest.fn().mockResolvedValue([]),
  };
  return {
    service: new RawMaterialsReportService(
      prisma as unknown as PrismaService,
      purchasing as unknown as PurchasingService,
    ),
    prisma,
    purchasing,
  };
}

describe('RawMaterialsReportService', () => {
  it('scopes warehouses to RAW_MATERIALS', async () => {
    const { service, prisma } = makeService();
    await service.build({ locale: 'en', user, period: 'month' });
    expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: WarehouseType.RAW_MATERIALS }),
      }),
    );
  });

  it('uses groupBy for balances and post-period net', async () => {
    const { service, prisma } = makeService();
    await service.build({ locale: 'en', user, period: 'today' });
    expect(prisma.inventoryBalance.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['inventoryItemId', 'warehouseId'],
        _sum: { availableQty: true, reservedQty: true },
      }),
    );
    expect(prisma.inventoryTransaction.groupBy).toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('RAW→RAW transfers net to zero at factory level', async () => {
    const { service } = makeService({
      $queryRaw: jest.fn().mockResolvedValue([
        {
          inventoryItemId: 'i1',
          type: 'WAREHOUSE_TRANSFER',
          warehouseId: 'wh-a',
          referenceType: 'WarehouseTransfer',
          qty: -6,
          valued: null,
          rows: 1,
          uncosted: 1,
        },
        {
          inventoryItemId: 'i1',
          type: 'WAREHOUSE_TRANSFER',
          warehouseId: 'wh-b',
          referenceType: 'WarehouseTransfer',
          qty: 6,
          valued: null,
          rows: 1,
          uncosted: 1,
        },
      ]),
    });
    const payload = await service.build({ locale: 'en', user, period: 'month' });
    const row = payload.items.find((i) => i.sku === 'FAB-1');
    expect(row).toBeDefined();
    expect(row!.transfersOut).toBe(6);
    expect(row!.transfersIn).toBe(6);
    expect(row!.residual).toBe(0);
    expect(row!.openingQty + row!.transfersIn - row!.transfersOut).toBe(row!.closingQty);
  });

  it('uncosted receipts stay null and never become 0', async () => {
    const { service } = makeService({
      $queryRaw: jest.fn().mockResolvedValue([
        {
          inventoryItemId: 'i1',
          type: 'PURCHASE_RECEIPT',
          warehouseId: 'wh-a',
          referenceType: 'GoodsReceipt',
          qty: 8,
          valued: null,
          rows: 2,
          uncosted: 2,
        },
      ]),
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ ...item, standardCost: null }]),
      },
    });
    const payload = await service.build({ locale: 'en', user, period: 'month' });
    expect(payload.summary.purchasesValue).toBeNull();
    expect(payload.summary.incompleteValuationMovementCount).toBe(2);
    expect(payload.costBasisId).toBe(RAW_MATERIALS_COST_BASIS_ID);
    const row = payload.items.find((i) => i.sku === 'FAB-1');
    expect(row?.closingValue).toBeNull();
  });

  it('echoes the resolved factory-local period', async () => {
    const { service } = makeService();
    const payload = await service.build({
      locale: 'en',
      user,
      period: 'custom',
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(payload.period).toEqual({
      preset: 'custom',
      fromYmd: '2026-08-01',
      toYmd: '2026-08-31',
    });
    expect(payload.timezone).toBe('Asia/Amman');
  });
});
