import { ReportsService } from './reports.service';
import type { PrismaService } from '../../common/prisma.service';
import { ProductionOrderStatus } from '@maher/database';

function boardRows(count: number, prefix: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    salesOrderId: `${prefix}-so-${i}`,
    originType: 'SALES_ORDER' as const,
  }));
}

describe('ReportsService productionSummary overview', () => {
  it('returns daily/weekly/monthly, late, completed, and overall progress', async () => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(2) // today
      .mockResolvedValueOnce(5) // week
      .mockResolvedValueOnce(12) // month
      .mockResolvedValueOnce(40); // completed total
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(boardRows(18, 'floor')) // in production boards
      .mockResolvedValueOnce(boardRows(4, 'late')) // late boards
      .mockResolvedValueOnce(boardRows(1, 'setup'))
      .mockResolvedValueOnce(boardRows(2, 'ready'))
      .mockResolvedValueOnce(boardRows(18, 'floor2'))
      .mockResolvedValueOnce(boardRows(3, 'blocked'))
      .mockResolvedValueOnce(boardRows(2, 'qc'));
    const aggregate = jest.fn().mockResolvedValue({
      _avg: { progressPercent: 67.4 },
    });

    const prisma = {
      productionOrder: { count, aggregate, findMany },
    } as unknown as PrismaService;

    const service = new ReportsService(prisma);
    const result = await service.productionSummary();

    expect(result).toEqual({
      dailyProduction: 2,
      weeklyProduction: 5,
      monthlyProduction: 12,
      completedToday: 2,
      completedThisWeek: 5,
      completedThisMonth: 12,
      completedOrders: 40,
      inProduction: 18,
      lateOrders: 4,
      overallProgress: 67,
      needsSetup: 1,
      readyToStart: 2,
      onFloor: 18,
      blocked: 3,
      inspectionPackaging: 2,
    });

    const lateCall = findMany.mock.calls[1][0];
    expect(lateCall.where.requiredDeliveryDate).toEqual({ lt: expect.any(Date) });
    expect(lateCall.where.status.notIn).toEqual([
      ProductionOrderStatus.COMPLETED,
      ProductionOrderStatus.CANCELLED,
    ]);
  });

  it('counts sibling production orders as one parent board', async () => {
    const count = jest.fn().mockResolvedValue(0);
    const findMany = jest.fn().mockResolvedValue([
      { id: 'po-1', salesOrderId: 'so-nile', originType: 'SALES_ORDER' },
      { id: 'po-2', salesOrderId: 'so-nile', originType: 'SALES_ORDER' },
      { id: 'po-3', salesOrderId: 'so-nile', originType: 'SALES_ORDER' },
      { id: 'po-4', salesOrderId: 'so-nile', originType: 'SALES_ORDER' },
    ]);
    const aggregate = jest.fn().mockResolvedValue({ _avg: { progressPercent: 0 } });
    const prisma = {
      productionOrder: { count, aggregate, findMany },
    } as unknown as PrismaService;

    const result = await new ReportsService(prisma).productionSummary();
    expect(result.inProduction).toBe(1);
    expect(result.lateOrders).toBe(1);
    expect(result.onFloor).toBe(1);
  });
});
