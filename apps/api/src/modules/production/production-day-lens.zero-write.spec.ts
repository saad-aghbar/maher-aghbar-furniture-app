/**
 * Phase C hard rule: selecting a date / day summary is view-filter only.
 */

import { ProductionService } from './production.service';

describe('Production day lens — zero writes', () => {
  it('daySummary and list do not call prisma create/update/delete', async () => {
    const writes: string[] = [];
    const writeFn = (name: string) =>
      jest.fn(() => {
        writes.push(name);
        return Promise.resolve(null);
      });

    const prisma = {
      factoryCalendar: {
        findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }),
      },
      productionOrder: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        create: writeFn('productionOrder.create'),
        update: writeFn('productionOrder.update'),
        updateMany: writeFn('productionOrder.updateMany'),
        delete: writeFn('productionOrder.delete'),
      },
      productionTask: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        create: writeFn('productionTask.create'),
        update: writeFn('productionTask.update'),
        updateMany: writeFn('productionTask.updateMany'),
      },
      productionTaskMaterialUsage: { findMany: jest.fn().mockResolvedValue([]) },
      wipKit: { findMany: jest.fn().mockResolvedValue([]) },
      wipHandoff: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryLot: { findMany: jest.fn().mockResolvedValue([]) },
      qualityInspection: { findMany: jest.fn().mockResolvedValue([]) },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (ops: unknown) => {
        if (Array.isArray(ops)) {
          return Promise.all(ops as Promise<unknown>[]);
        }
        return [];
      }),
    };

    const service = new ProductionService(
      prisma as never,
      {} as never,
      { next: jest.fn() } as never,
      { summaryForProductionOrder: jest.fn() } as never,
      { generateForProductionOrder: jest.fn() } as never,
    );

    (service as unknown as { loadCatalogImageIndex: () => Promise<unknown[]> }).loadCatalogImageIndex =
      async () => [];

    await service.daySummary({ onDate: '2026-09-08' });
    await service.list({ page: 1, pageSize: 20, onDate: '2026-09-08', dateMode: 'planned' });

    expect(writes).toEqual([]);
    expect(prisma.productionOrder.create).not.toHaveBeenCalled();
    expect(prisma.productionOrder.update).not.toHaveBeenCalled();
    expect(prisma.productionTask.update).not.toHaveBeenCalled();
  });
});
