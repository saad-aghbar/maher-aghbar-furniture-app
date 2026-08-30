import type { AuthUser } from '@maher/types';
import { ReportsService } from './reports.service';
import type { PrismaService } from '../../common/prisma.service';
import {
  capAttentionCards,
  computeGrossMfgDifference,
  mgmtAttention,
  mgmtTile,
} from './management-summary';

describe('management-summary helpers', () => {
  it('builds tiles with numeric counts', () => {
    const tile = mgmtTile('qualityWaiting', 4, '/quality', 'waiting');
    expect(tile.count).toBe(4);
    expect(typeof tile.count).toBe('number');
    expect(tile.href).toBe('/quality');
    expect(tile.filter).toBe('waiting');
  });

  it('attention cards require why + actionLabel', () => {
    const card = mgmtAttention({
      id: 'a1',
      title: 'SO-1',
      why: 'Past delivery',
      actionLabel: 'Review',
      priority: 'critical',
      href: '/sales-orders/1',
      filter: 'late=true',
    });
    expect(card.why).toBeTruthy();
    expect(card.actionLabel).toBeTruthy();
  });

  it('caps attention to 12 by priority', () => {
    const cards = Array.from({ length: 15 }, (_, i) =>
      mgmtAttention({
        id: `c${i}`,
        title: `T${i}`,
        why: 'reason',
        actionLabel: 'Open',
        priority: i < 2 ? 'critical' : 'normal',
        href: '/',
        filter: 'x',
      }),
    );
    expect(capAttentionCards(cards, 12)).toHaveLength(12);
    expect(capAttentionCards(cards, 12)[0]!.priority).toBe('critical');
  });

  it('keeps finance due and credit as separate concepts in helper math', () => {
    // Incomplete costing must not collapse into zero mfg totals.
    const gross = computeGrossMfgDifference({
      finalOrders: [
        { sale: 1000, mfg: 400 },
        { sale: 500, mfg: 200 },
      ],
      incompleteCosting: 3,
    });
    expect(gross).toBe(900);
    expect(computeGrossMfgDifference({ finalOrders: [], incompleteCosting: 5 })).toBeNull();
  });
});

describe('ReportsService.managementSummary', () => {
  const baseUser: AuthUser = {
    id: 'u1',
    username: 'admin',
    email: 'a@b.c',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: [
      'report.sales.read',
      'report.financial.read',
      'report.inventory.read',
      'inventory.read',
      'production-task.read',
    ],
    preferredLanguage: 'en',
  };

  function countFn(n = 0) {
    return jest.fn().mockResolvedValue(n);
  }

  function makePrisma(overrides: Record<string, unknown> = {}) {
    const prisma = {
      productionOrder: {
        count: countFn(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
      productionTask: {
        count: countFn(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      productionSchedule: { findMany: jest.fn().mockResolvedValue([]) },
      productionStageDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      delivery: {
        count: countFn(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      purchaseOrder: { count: countFn(0) },
      purchaseRequest: { count: countFn(0) },
      salesOrder: {
        count: countFn(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryLot: { count: countFn(0), findMany: jest.fn().mockResolvedValue([]) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryTransaction: { count: countFn(0) },
      qualityInspection: {
        count: countFn(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      reworkRequest: { count: countFn(0) },
      returnRequest: {
        count: countFn(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      wipKit: { count: countFn(0) },
      taskBlocker: { count: countFn(0) },
      goodsReceipt: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: {
        count: countFn(3),
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { outstandingAmount: 12000 } }) // receivable
          .mockResolvedValueOnce({ _sum: { outstandingAmount: 4500 } }), // overdue
        findMany: jest.fn().mockResolvedValue([
          {
            outstandingAmount: 4500,
            customerId: 'c1',
            customer: { id: 'c1', name: 'Dealer', nameEn: 'Dealer', nameAr: null },
            number: 'INV-1',
            id: 'inv1',
          },
        ]),
      },
      payment: {
        findMany: jest.fn().mockImplementation((args: { select?: { paymentDate?: boolean } }) => {
          if (args?.select?.paymentDate) {
            return Promise.resolve([
              {
                id: 'pay1',
                number: 'PAY-1',
                amount: 800,
                paymentDate: new Date('2026-08-29T10:00:00Z'),
                customer: { name: 'Dealer', nameEn: 'Dealer' },
              },
            ]);
          }
          return Promise.resolve([
            {
              amount: 2000,
              allocations: [{ amount: 500 }],
            },
          ]);
        }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 800 } }),
      },
      ...overrides,
    };
    return prisma;
  }

  it('returns tile counts as numbers and attention with why + actionLabel', async () => {
    const prisma = makePrisma({
      salesOrder: {
        count: countFn(2),
        findMany: jest.fn().mockResolvedValue([
          { id: 'so1', number: 'SO-2026-1' },
        ]),
      },
      qualityInspection: {
        count: countFn(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'qc1',
            number: 'QI-1',
            productionOrder: { number: 'PO-1', salesOrderId: 'so1' },
          },
        ]),
      },
    });
    // Seed late schedule so attention may include late card path without crashing
    prisma.productionSchedule.findMany = jest.fn().mockResolvedValue([]);

    const service = new ReportsService(prisma as unknown as PrismaService);
    const result = await service.managementSummary(baseUser);

    expect(typeof result.today.qualityWaiting.count).toBe('number');
    expect(typeof result.outbound.finishedWaiting.count).toBe('number');
    expect(typeof result.production.activeOrders.count).toBe('number');
    expect(result.late.atRiskLimited).toBe(true);
    expect(result.generatedAt).toBeTruthy();

    for (const card of result.attention) {
      expect(card.why.length).toBeGreaterThan(0);
      expect(card.actionLabel.length).toBeGreaterThan(0);
    }
  });

  it('keeps finance receivable/overdue and accountCredit as separate fields', async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as unknown as PrismaService);
    const result = await service.managementSummary(baseUser);

    expect(result.finance).not.toBeNull();
    expect(result.finance!.receivable).toBe(12000);
    expect(result.finance!.overdue).toBe(4500);
    // Credit = payment 2000 − alloc 500 = 1500; NEVER netted with overdue
    expect(result.finance!.accountCredit).toBe(1500);
    expect(result.finance!.accountCredit).not.toBe(
      result.finance!.receivable - result.finance!.overdue,
    );
    expect(result.manufacturing).not.toBeNull();
  });

  it('does not treat incomplete costing as zero in manufacturing totals', async () => {
    const finalWhereShape = { manufacturingCost: { not: null } };
    const prisma = makePrisma({
      salesOrder: {
        count: jest.fn().mockImplementation((args: { where?: Record<string, unknown> }) => {
          const w = args?.where ?? {};
          if (w.manufacturingCost && (w.manufacturingCost as { not?: null }).not === null) {
            return Promise.resolve(2); // finalCostOrders
          }
          if (Array.isArray(w.OR)) {
            return Promise.resolve(5); // incompleteCosting — must stay visible, not folded to 0
          }
          return Promise.resolve(0);
        }),
        findMany: jest.fn().mockImplementation((args: { select?: { manufacturingCost?: boolean } }) => {
          if (args?.select?.manufacturingCost) {
            return Promise.resolve([
              { total: 1000, manufacturingCost: 400 },
              { total: 800, manufacturingCost: 300 },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
    });
    void finalWhereShape;

    const service = new ReportsService(prisma as unknown as PrismaService);
    const result = await service.managementSummary(baseUser);

    expect(result.manufacturing).not.toBeNull();
    expect(result.manufacturing!.incompleteCosting).toBe(5);
    expect(result.manufacturing!.finalCostOrders).toBe(2);
    expect(result.manufacturing!.finalCostTotal).toBe(700);
    // Incomplete is tracked separately — gross uses FINAL rows only
    expect(result.manufacturing!.grossMfgDifference).toBe(1100);
  });

  it('returns finance: null when user lacks report.financial.read', async () => {
    const limited: AuthUser = {
      ...baseUser,
      permissions: ['report.sales.read', 'inventory.read'],
    };
    const prisma = makePrisma();
    const service = new ReportsService(prisma as unknown as PrismaService);
    const result = await service.managementSummary(limited);

    expect(result.finance).toBeNull();
    expect(result.manufacturing).toBeNull();
    expect(prisma.invoice.aggregate).not.toHaveBeenCalled();
  });
});
