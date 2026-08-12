import type { AuthUser } from '@maher/types';
import { SalesOrdersService } from './sales-orders.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';

const LEAK_KEYS = [
  'manufacturingCost',
  'costBreakdown',
  'productionPrice',
  'profit',
  'bomDefaults',
  'currentStageCode',
  'currentStage',
];

function assertNoLeaks(value: unknown, path = 'root'): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoLeaks(item, `${path}[${i}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (LEAK_KEYS.includes(key)) {
      throw new Error(`Leak field "${key}" present at ${path}`);
    }
    assertNoLeaks(child, `${path}.${key}`);
  }
}

describe('SalesOrdersService.list scope', () => {
  const dealerA: AuthUser = {
    id: 'user-a',
    username: 'cedar',
    email: 'cedar@example.com',
    name: 'Cedar',
    roles: ['CUSTOMER'],
    permissions: ['sales-order.read'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
  };

  const admin: AuthUser = {
    id: 'admin',
    username: 'admin',
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMIN'],
    permissions: ['sales-order.read', 'report.financial.read'],
    preferredLanguage: 'en',
  };

  function makeService(findManyResult: unknown[] = []) {
    const count = jest.fn().mockResolvedValue(findManyResult.length);
    const findMany = jest.fn().mockResolvedValue(findManyResult);
    const $transaction = jest.fn(async (ops: unknown[]) => {
      // Prisma $transaction with array of promises
      return Promise.all(ops as Promise<unknown>[]);
    });

    const prisma = {
      salesOrder: { count, findMany },
      $transaction,
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      dealerPrice: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      productionStageDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const sequences = {} as SequenceService;
    const service = new SalesOrdersService(
      prisma as unknown as PrismaService,
      sequences,
      { sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }), notifyAdminUsers: jest.fn().mockResolvedValue({ ok: true }), notifyCustomerUsers: jest.fn().mockResolvedValue({ ok: true }) } as any,
      { createAccessToken: jest.fn(() => 'tok') } as any,
      { generateForProductionOrder: jest.fn().mockResolvedValue(undefined) } as any,
    );

    // Avoid hydrate / catalog side effects
    jest.spyOn(service, 'hydrateLineProducts').mockImplementation(async (lines) => lines as never);
    jest.spyOn(service, 'loadDealerPrices').mockResolvedValue(new Map());
    jest.spyOn(service, 'loadMaterialCosts').mockResolvedValue(new Map());

    return { service, count, findMany, prisma };
  }

  const sampleRow = {
    id: 'so1',
    number: 'ORD-1',
    status: 'IN_PRODUCTION',
    priority: 'HIGH',
    customerId: 'customer-a',
    total: 1000,
    requiredDeliveryDate: new Date('2026-08-20'),
    customer: { id: 'customer-a', name: 'Cedar', nameAr: null, nameEn: 'Cedar', nameHe: null, code: 'C1' },
    quotation: null,
    lines: [
      {
        id: 'l1',
        description: 'Sofa',
        quantity: 1,
        unitPrice: 1000,
        lineTotal: 1000,
        productId: 'p1',
        product: {
          id: 'p1',
          sku: 'S1',
          nameAr: null,
          nameEn: 'Sofa',
          nameHe: null,
          imageUrl: null,
          manufacturingCost: 400,
          basePrice: 900,
          bomDefaults: { secret: true },
        },
      },
    ],
    productionOrders: [
      {
        id: 'po1',
        number: 'PO-1',
        status: 'IN_PROGRESS',
        currentStageCode: 'UPHOLSTERY',
        progressPercent: 55,
      },
    ],
  };

  it('forces dealer customerId and ignores query override for another dealer', async () => {
    const { service, findMany, count } = makeService([]);
    await service.list(
      { page: 1, pageSize: 20, customerId: 'customer-b' } as never,
      dealerA,
    );

    expect(findMany.mock.calls[0][0].where.customerId).toBe('customer-a');
    expect(count.mock.calls[0][0].where.customerId).toBe('customer-a');
    expect(findMany.mock.calls[0][0].where.customerId).not.toBe('customer-b');
  });

  it('strips cost/profit/stage leaks for dealers', async () => {
    const { service } = makeService([sampleRow]);
    jest.spyOn(service, 'costsForLines').mockReturnValue({
      sellerPrice: 1000,
      productionPrice: 400,
      manufacturingCost: 400,
      profit: 600,
      costBreakdown: { wood: 100 },
    } as never);

    const result = await service.list({ page: 1, pageSize: 20 } as never, dealerA);
    const row = result.data[0] as Record<string, unknown>;
    expect(row.sellerPrice).toBe(1000);
    expect(row.progressPercent).toBeDefined();
    assertNoLeaks(row);
  });

  it('keeps cost and profit for admin', async () => {
    const { service, findMany } = makeService([sampleRow]);
    jest.spyOn(service, 'costsForLines').mockReturnValue({
      sellerPrice: 1000,
      productionPrice: 400,
      manufacturingCost: 400,
      profit: 600,
      costBreakdown: { wood: 100 },
    } as never);

    const result = await service.list({ page: 1, pageSize: 20 } as never, admin);
    const row = result.data[0] as Record<string, unknown>;
    expect(row.manufacturingCost).toBe(400);
    expect(row.profit).toBe(600);
    expect(findMany.mock.calls[0][0].where.customerId).toBeUndefined();
  });

  it('applies sortBy and statusGroup', async () => {
    const { service, findMany } = makeService([]);
    await service.list(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'number',
        sortDir: 'asc',
        statusGroup: 'production',
      } as never,
      admin,
    );

    expect(findMany.mock.calls[0][0].orderBy).toEqual({ number: 'asc' });
    expect(findMany.mock.calls[0][0].where.status).toEqual({
      in: expect.arrayContaining(['IN_PRODUCTION']),
    });
  });
});
