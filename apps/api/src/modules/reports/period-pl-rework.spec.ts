import { ReportsService } from './reports.service';

describe('ReportsService.periodPl rework line', () => {
  it('adds a returns/rework cost line without changing sales-order COGS', async () => {
    const prisma = {
      salesOrder: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'so-1', total: 1000, manufacturingCost: 400, status: 'CONFIRMED' },
        ]),
      },
      invoice: { aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 }, _count: 0 }) },
      supplierInvoice: { aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 }, _count: 0 }) },
      taskTimeEntry: { findMany: jest.fn().mockResolvedValue([]) },
      productionTaskMaterialUsage: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { extendedCost: 75 } })
          .mockResolvedValueOnce({ _sum: { extendedCost: 40 } }),
      },
      returnRecoveryLine: {
        findMany: jest.fn().mockResolvedValue([
          { outcome: 'DISPOSE', quantity: 2, unitCost: 10 },
          { outcome: 'RECOVER_TO_INVENTORY', quantity: 1, unitCost: 8 },
        ]),
      },
      systemSetting: { findUnique: jest.fn().mockResolvedValue({ value: { defaultLaborRateJod: 5 } }) },
    };
    const service = new ReportsService(prisma as never);

    const result = await service.periodPl({});

    expect(prisma.productionTaskMaterialUsage.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productionOrder: expect.objectContaining({
            originType: 'RETURN_WORK',
          }),
        }),
      }),
    );
    expect(Number(result.totals.materialCogs)).toBe(400);
    expect(Number(result.totals.reworkCost)).toBe(75);
    expect(Number(result.totals.replacementCost)).toBe(40);
    expect(Number(result.totals.scrapValue)).toBe(20);
    expect(Number(result.totals.recoveredValue)).toBe(8);
    expect(Number(result.totals.returnWriteOff)).toBe(12);
    expect(Number(result.totals.grossProfit)).toBe(600);
  });
});
