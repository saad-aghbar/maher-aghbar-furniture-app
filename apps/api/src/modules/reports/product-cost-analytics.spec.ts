import { deriveProductStats, sortProductStats } from './product-cost-analytics';

describe('product-cost-analytics', () => {
  it('derives stats from real order histories and never invents a product cost', () => {
    const stats = deriveProductStats([
      { productId: 'sofa', actualCost: 100, workerEffortMinutes: 60 },
      { productId: 'sofa', actualCost: 140, workerEffortMinutes: 80 },
      { productId: 'sofa', actualCost: null, workerEffortMinutes: 0 },
    ]);
    expect(stats[0]).toMatchObject({
      productId: 'sofa',
      orderCount: 3,
      averageActualCost: 120,
      lowestActualCost: 100,
      highestActualCost: 140,
      averageEffortMinutes: 70,
      unitsProduced: 0,
    });
  });
});

describe('sortProductStats', () => {
  it('sorts by lowest margin without inventing missing averages', () => {
    const rows = [
      { orderCount: 1, averageActualCost: 80, averageMargin: 40, unitsProduced: 2, returnRate: 0, lowestActualCost: 80, highestActualCost: 80 },
      { orderCount: 1, averageActualCost: 90, averageMargin: 10, unitsProduced: 1, returnRate: 0, lowestActualCost: 90, highestActualCost: 90 },
    ];
    expect(sortProductStats(rows, 'lowestMargin')[0].averageMargin).toBe(10);
  });
});
