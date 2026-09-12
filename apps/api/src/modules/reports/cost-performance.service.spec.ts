import { NotFoundException } from '@nestjs/common';
import { SalesOrderStatus } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { CostPerformanceService } from './cost-performance.service';
import { costOrdersWhere, costReturnsWhere } from './cost-query';
import type { PrismaService } from '../../common/prisma.service';

function admin(perms: string[] = ['inventory.cost.read']): AuthUser {
  return {
    id: 'admin-1',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: perms,
    preferredLanguage: 'en',
  };
}

describe('cost query filters', () => {
  it('narrows orders by productId and status', () => {
    const where = costOrdersWhere({
      productId: 'prod-1',
      status: 'IN_PRODUCTION',
      customerId: 'cust-1',
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(where.customerId).toBe('cust-1');
    expect(where.status).toBe(SalesOrderStatus.IN_PRODUCTION);
    expect(where.lines).toEqual({ some: { productId: 'prod-1' } });
    expect(where.orderDate).toEqual(
      expect.objectContaining({
        gte: expect.any(Date),
        lte: expect.any(Date),
      }),
    );
  });

  it('narrows orders by variantId and optionValueId', () => {
    const where = costOrdersWhere({
      productId: 'prod-1',
      variantId: 'var-1',
      optionValueId: 'opt-1',
    });
    expect(where.lines).toEqual({
      some: {
        productId: 'prod-1',
        variantId: 'var-1',
        lineOptions: { some: { specOptionValueId: 'opt-1' } },
      },
    });
  });

  it('ignores unknown status instead of throwing', () => {
    expect(costOrdersWhere({ status: 'NOPE' }).status).toBeUndefined();
  });

  it('narrows returns by productId and lifecycle status', () => {
    const where = costReturnsWhere({ productId: 'prod-1', status: 'REQUESTED' });
    expect(where.OR).toEqual([
      { productId: 'prod-1' },
      { salesOrderLine: { productId: 'prod-1' } },
    ]);
    expect(where.lifecycleState).toBe('REQUESTED');
  });
});

describe('CostPerformanceService', () => {
  it('404s dealers on every cost route', async () => {
    const svc = new CostPerformanceService({} as PrismaService);
    const dealer: AuthUser = { ...admin(), customerId: 'c1', roles: ['CUSTOMER'], permissions: [] };
    await expect(svc.listOrders({ user: dealer })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.listReturns({ user: dealer })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.productAnalytics(dealer)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.dossier('so-1', dealer)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.listLaborRates(dealer)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.listLaborActuals({ user: dealer })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('paginates products and keeps lowest/highest actual cost', async () => {
    const prisma = {
      salesOrder: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'so-1',
            lines: [
              {
                productId: 'sofa',
                productionOrders: [{ id: 'po-1', tasks: [{ actualMinutes: 60 }] }],
              },
            ],
          },
          {
            id: 'so-2',
            lines: [
              {
                productId: 'sofa',
                productionOrders: [{ id: 'po-2', tasks: [{ actualMinutes: 80 }] }],
              },
            ],
          },
          {
            id: 'so-3',
            lines: [
              {
                productId: 'table',
                productionOrders: [{ id: 'po-3', tasks: [{ actualMinutes: 10 }] }],
              },
            ],
          },
        ]),
      },
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([
          { type: 'PRODUCTION_ISSUE', quantity: -1, unitCost: 100, productionOrderId: 'po-1', referenceType: 'ProductionOrder', referenceId: 'po-1' },
          { type: 'PRODUCTION_ISSUE', quantity: -1, unitCost: 140, productionOrderId: 'po-2', referenceType: 'ProductionOrder', referenceId: 'po-2' },
          { type: 'PRODUCTION_ISSUE', quantity: -1, unitCost: 50, productionOrderId: 'po-3', referenceType: 'ProductionOrder', referenceId: 'po-3' },
        ]),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'sofa', sku: 'SOFA', nameEn: 'Sofa', nameAr: null, nameHe: null },
        ]),
      },
    };
    const svc = new CostPerformanceService(prisma as unknown as PrismaService);
    const page1 = await svc.productAnalytics(admin(), { page: 1, pageSize: 1 });
    expect(page1.meta.totalItems).toBe(2);
    expect(page1.meta.pageSize).toBe(1);
    expect(page1.data).toHaveLength(1);
    const sofa = page1.products.find((p: { productId: string }) => p.productId === 'sofa');
    if (sofa) {
      expect(sofa.lowestActualCost).toBe(100);
      expect(sofa.highestActualCost).toBe(140);
    }
    const filtered = await svc.productAnalytics(admin(), { productId: 'sofa' });
    expect(filtered.meta.totalItems).toBe(1);
    expect(filtered.data[0].lowestActualCost).toBe(100);
    expect(filtered.data[0].highestActualCost).toBe(140);
    expect(filtered.labor).toBeNull();
    expect(page1.variants).toEqual([]);
    expect(page1.byOption).toEqual([]);
  });

  it('puts planned, actual, variance and reserved labor on one order row', async () => {
    const prisma = {
      salesOrder: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'so-1',
            number: 'SO-1',
            status: 'IN_PRODUCTION',
            orderDate: new Date('2026-01-10'),
            subtotal: 400,
            manufacturingCost: 100,
            plannedCostFrozenAt: new Date('2026-01-02'),
            customer: { nameEn: 'Nile', nameAr: null, nameHe: null },
            lines: [{ id: 'l1', description: 'Sofa', quantity: 1, product: { sku: 'SOFA', nameEn: 'Sofa', nameAr: null } }],
            invoices: [{ subtotal: 400 }],
            productionOrders: [
              {
                id: 'po-1',
                quantity: 1,
                actualStartDate: null,
                actualCompletionDate: null,
                plannedMaterialCost: 100,
                plannedCostFrozenAt: new Date('2026-01-02'),
                tasks: [{ actualMinutes: 30, isRework: false }],
              },
            ],
          },
        ]),
      },
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            type: 'PRODUCTION_ISSUE',
            quantity: -1,
            unitCost: 120,
            productionOrderId: 'po-1',
            referenceType: 'ProductionOrder',
            referenceId: 'po-1',
          },
        ]),
      },
    };
    const svc = new CostPerformanceService(prisma as unknown as PrismaService);
    const result = await svc.listOrders({ user: admin(), productId: 'prod-1', status: 'IN_PRODUCTION' });
    expect(prisma.salesOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: SalesOrderStatus.IN_PRODUCTION,
          lines: { some: { productId: 'prod-1' } },
        }),
      }),
    );
    const row = result.data[0];
    expect(row.plannedCost).toBe(100);
    expect(row.actualCost).toBe(120);
    expect(row.variance).toBe(20);
    expect(row.labor).toBeNull();
    expect(result.meta.page).toBe(1);
  });

  it('costs each worker at their own rate and subtracts labor from margin', async () => {
    const prisma = {
      salesOrder: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'so-1',
            number: 'SO-1',
            status: 'COMPLETED',
            orderDate: new Date('2026-01-10'),
            subtotal: 200,
            manufacturingCost: 100,
            plannedCostFrozenAt: new Date('2026-01-02'),
            customer: { nameEn: 'Nile', nameAr: null, nameHe: null },
            lines: [{ id: 'l1', description: 'Sofa', quantity: 1, product: { sku: 'SOFA', nameEn: 'Sofa', nameAr: null } }],
            invoices: [{ subtotal: 200 }],
            productionOrders: [
              {
                id: 'po-1',
                quantity: 1,
                actualStartDate: null,
                actualCompletionDate: null,
                plannedMaterialCost: 100,
                plannedCostFrozenAt: new Date('2026-01-02'),
                tasks: [{ id: 't1', actualMinutes: 90, isRework: false, assignedEmployeeId: 'a', stageDefinitionId: 'uph' }],
              },
            ],
          },
        ]),
      },
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            type: 'PRODUCTION_ISSUE',
            quantity: -1,
            unitCost: 100,
            productionOrderId: 'po-1',
            referenceType: 'ProductionOrder',
            referenceId: 'po-1',
          },
        ]),
      },
      laborRate: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'a', hourlyRate: 20, effectiveFrom: new Date('2026-01-01'), effectiveTo: null },
          { userId: 'b', hourlyRate: 40, effectiveFrom: new Date('2026-01-01'), effectiveTo: null },
        ]),
      },
      taskTimeEntry: {
        findMany: jest.fn().mockResolvedValue([
          { taskId: 't1', userId: 'a', minutes: 60, startedAt: new Date('2026-01-03'), endedAt: null },
          { taskId: 't1', userId: 'b', minutes: 30, startedAt: new Date('2026-01-03'), endedAt: null },
        ]),
      },
    };
    const svc = new CostPerformanceService(prisma as unknown as PrismaService);
    const row = (await svc.listOrders({ user: admin() })).data[0];
    expect(row.labor).toBe(40);
    expect(row.grossMargin).toBe(60);
    expect(row.marginPct).toBe(30);
  });

  it('returns labor actuals by worker and stage', async () => {
    const prisma = {
      taskTimeEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            taskId: 't1',
            userId: 'a',
            minutes: 60,
            startedAt: new Date('2026-01-03'),
            endedAt: null,
            user: { id: 'a', firstName: 'Yousef', lastName: 'Haddad' },
            task: { id: 't1', stageDefinitionId: 'uph', stageDefinition: { code: 'UPH', nameEn: 'Upholstery', nameAr: null } },
          },
        ]),
      },
      laborRate: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'a', hourlyRate: 20, effectiveFrom: new Date('2026-01-01'), effectiveTo: null },
        ]),
      },
    };
    const svc = new CostPerformanceService(prisma as unknown as PrismaService);
    const result = await svc.listLaborActuals({ user: admin() });
    expect(result.labor?.actual).toBe(20);
    expect(result.byWorker[0]).toEqual(expect.objectContaining({ userId: 'a', name: 'Yousef Haddad', actual: 20 }));
  });
});
