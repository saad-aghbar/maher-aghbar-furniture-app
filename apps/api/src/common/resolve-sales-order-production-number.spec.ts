import { resolveSalesOrderProductionNumber } from './resolve-sales-order-production-number';

describe('resolveSalesOrderProductionNumber', () => {
  const order = { id: 'so-1', number: 'SO-2026-00026' };

  it('uses the line letter already stored', async () => {
    const tx = {
      salesOrderLine: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    await expect(
      resolveSalesOrderProductionNumber(tx, order, { id: 'line-1', itemLetter: 'b' }),
    ).resolves.toBe('SO-2026-00026.B');
    expect(tx.salesOrderLine.findMany).not.toHaveBeenCalled();
    expect(tx.salesOrderLine.update).not.toHaveBeenCalled();
  });

  it('persists the next unused letter when missing (does not reuse deleted A)', async () => {
    const tx = {
      salesOrderLine: {
        findMany: jest.fn().mockResolvedValue([{ itemLetter: 'A' }, { itemLetter: 'C' }]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    await expect(
      resolveSalesOrderProductionNumber(tx, order, { id: 'line-2', itemLetter: null }),
    ).resolves.toBe('SO-2026-00026.B');
    expect(tx.salesOrderLine.update).toHaveBeenCalledWith({
      where: { id: 'line-2' },
      data: { itemLetter: 'B' },
    });
  });
});
