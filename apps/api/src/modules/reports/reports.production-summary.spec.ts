import { ReportsService } from './reports.service';
import type { PrismaService } from '../../common/prisma.service';
import { ProductionOrderStatus } from '@maher/database';

describe('ReportsService productionSummary overview', () => {
  it('returns daily/weekly/monthly, late, completed, and overall progress', async () => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(2) // today
      .mockResolvedValueOnce(5) // week
      .mockResolvedValueOnce(12) // month
      .mockResolvedValueOnce(40) // completed total
      .mockResolvedValueOnce(18) // in production
      .mockResolvedValueOnce(4); // late
    const aggregate = jest.fn().mockResolvedValue({
      _avg: { progressPercent: 67.4 },
    });

    const prisma = {
      productionOrder: { count, aggregate },
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
    });

    const lateCall = count.mock.calls[5][0];
    expect(lateCall.where.requiredDeliveryDate).toEqual({ lt: expect.any(Date) });
    expect(lateCall.where.status.notIn).toEqual([
      ProductionOrderStatus.COMPLETED,
      ProductionOrderStatus.CANCELLED,
    ]);
  });
});
