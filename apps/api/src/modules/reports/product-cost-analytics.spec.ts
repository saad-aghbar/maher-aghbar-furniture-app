import { deriveProductStats } from './product-cost-analytics';

describe('product-cost-analytics', () => {
  it('derives stats from real order histories and never invents a product cost', () => {
    const stats = deriveProductStats([
      { productId: 'sofa', actualCost: 100, workerEffortMinutes: 60 },
      { productId: 'sofa', actualCost: 140, workerEffortMinutes: 80 },
      { productId: 'sofa', actualCost: null, workerEffortMinutes: 0 },
    ]);
    expect(stats).toEqual([
      {
        productId: 'sofa',
        orderCount: 3,
        averageActualCost: 120,
        lowestActualCost: 100,
        highestActualCost: 140,
        averageEffortMinutes: 70,
      },
    ]);
  });
});
