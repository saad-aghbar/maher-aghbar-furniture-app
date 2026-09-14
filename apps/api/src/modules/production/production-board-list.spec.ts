import { ProductionService } from './production.service';

function poRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1',
    number: 'PO-1',
    salesOrderId: 'so-nile',
    originType: 'SALES_ORDER',
    status: 'IN_PROGRESS',
    priority: 'NORMAL',
    progressPercent: 40,
    requiredDeliveryDate: null,
    plannedStartDate: null,
    actualStartDate: null,
    releasedToFactoryAt: null,
    customerId: null,
    productDescription: 'Karina sofa',
    currentStageCode: 'CUT',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    salesOrder: {
      id: 'so-nile',
      number: 'SO-2026-00026',
      customerId: 'c-nile',
      customer: { id: 'c-nile', nameEn: 'Nile Interiors' },
    },
    salesOrderLine: {
      id: 'line-1',
      description: 'Karina',
      quantity: 1,
      sortOrder: 0,
      manufacturingComplexity: 'STANDARD',
      product: { nameEn: 'Karina sofa', imageUrl: null },
    },
    product: { nameEn: 'Karina sofa', imageUrl: null },
    stages: [],
    tasks: [],
    _count: { schedules: 0 },
    returnRequest: null,
    ...overrides,
  };
}

function makeService(prisma: unknown) {
  const service = new ProductionService(
    prisma as never,
    {} as never,
    { next: jest.fn() } as never,
    { summaryForProductionOrder: jest.fn() } as never,
    { generateForProductionOrder: jest.fn() } as never,
  );
  (service as unknown as { loadCatalogImageIndex: () => Promise<unknown[]> }).loadCatalogImageIndex =
    async () => [];
  return service;
}

describe('ProductionService list boards', () => {
  const nileMatches = [
    { id: 'po-std', salesOrderId: 'so-nile', originType: 'SALES_ORDER' },
    { id: 'po-karina', salesOrderId: 'so-nile', originType: 'SALES_ORDER' },
    { id: 'po-mod', salesOrderId: 'so-nile', originType: 'SALES_ORDER' },
    { id: 'po-custom', salesOrderId: 'so-nile', originType: 'SALES_ORDER' },
  ];

  const nileSiblings = [
    poRow({
      id: 'po-std',
      number: 'PO-STD',
      salesOrderLine: {
        id: 'line-std',
        description: 'Std',
        quantity: 2,
        sortOrder: 0,
        manufacturingComplexity: 'STANDARD',
        product: { nameEn: 'Std sofa', imageUrl: null },
      },
    }),
    poRow({
      id: 'po-karina',
      number: 'PO-KAR',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      salesOrderLine: {
        id: 'line-kar',
        description: 'Karina',
        quantity: 1,
        sortOrder: 1,
        manufacturingComplexity: 'STANDARD',
        product: { nameEn: 'Karina', imageUrl: null },
      },
    }),
    poRow({
      id: 'po-mod',
      number: 'PO-MOD',
      createdAt: new Date('2026-01-04T00:00:00.000Z'),
      salesOrderLine: {
        id: 'line-mod',
        description: 'Mod',
        quantity: 1,
        sortOrder: 2,
        manufacturingComplexity: 'MODIFIED',
        product: { nameEn: 'Mod sofa', imageUrl: null },
      },
    }),
    poRow({
      id: 'po-custom',
      number: 'PO-CUS',
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
      salesOrderLine: {
        id: 'line-cus',
        description: 'Custom',
        quantity: 1,
        sortOrder: 3,
        manufacturingComplexity: 'CUSTOM',
        product: { nameEn: 'Custom sofa', imageUrl: null },
      },
    }),
  ];

  it('paginates one parent board for a four-line sales order', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(nileMatches)
      .mockResolvedValueOnce(nileSiblings);
    const prisma = {
      productionOrder: { findMany, count: jest.fn() },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (ops: unknown) =>
        Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : [],
      ),
    };
    const result = await makeService(prisma).list({
      page: 1,
      pageSize: 20,
      group: 'boards',
    });
    expect(result.meta.totalItems).toBe(1);
    expect(result.data).toHaveLength(1);
    const board = result.data[0] as { id: string; items: Array<{ id: string; matched: boolean }> };
    expect(board.id).toBe('so-nile');
    expect(board.items.map((i) => i.id)).toEqual([
      'po-std',
      'po-karina',
      'po-mod',
      'po-custom',
    ]);
    expect(board.items.every((i) => i.matched)).toBe(true);
  });

  it('keeps unmatched siblings when filtering Custom', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([nileMatches[3]])
      .mockResolvedValueOnce(nileSiblings);
    const prisma = {
      productionOrder: { findMany, count: jest.fn() },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (ops: unknown) =>
        Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : [],
      ),
    };
    const result = await makeService(prisma).list({
      page: 1,
      pageSize: 20,
      group: 'boards',
      complexity: 'CUSTOM',
    });
    const board = result.data[0] as {
      items: Array<{ id: string; matched: boolean; manufacturingComplexity: string }>;
    };
    expect(result.meta.totalItems).toBe(1);
    expect(board.items).toHaveLength(4);
    expect(board.items.find((i) => i.id === 'po-custom')?.matched).toBe(true);
    expect(board.items.filter((i) => i.matched)).toHaveLength(1);
    expect(findMany.mock.calls[0][0].where.AND).toEqual(
      expect.arrayContaining([
        { salesOrderLine: { manufacturingComplexity: 'CUSTOM' } },
      ]),
    );
    expect(findMany.mock.calls[1][0].where.originType ?? findMany.mock.calls[1][0].where.OR).toBeDefined();
  });

  it('counts distinct parent boards in the day summary', async () => {
    const findMany = jest.fn().mockResolvedValue(nileMatches);
    const prisma = {
      factoryCalendar: {
        findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }),
      },
      productionOrder: {
        findMany,
        count: jest.fn().mockResolvedValue(0),
      },
      productionTask: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (ops: unknown) =>
        Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : [],
      ),
    };
    const result = await makeService(prisma).daySummary({ onDate: '2026-09-08' });
    expect(result.planned.orders).toBe(1);
    expect(result.actual.orders).toBe(1);
    expect(result.board.needsSetup).toBe(1);
    expect(result.board.onFloor).toBe(1);
  });
});
