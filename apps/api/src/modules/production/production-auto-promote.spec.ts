import { ProductionService } from './production.service';
import type { PrismaService } from '../../common/prisma.service';
import type { StagePipelineService } from './stage-pipeline.service';

describe('ProductionService — no date auto-promote to In Production', () => {
  function buildService(prisma: PrismaService, pipeline: StagePipelineService) {
    return new ProductionService(
      prisma,
      pipeline,
      { next: jest.fn() } as never,
      { summaryForProductionOrder: jest.fn() } as never,
      { generateForProductionOrder: jest.fn() } as never,
    );
  }

  it('does not expose maybePromoteReleasedOrderOnDate (removed)', () => {
    const service = buildService({} as PrismaService, {} as StagePipelineService);
    expect(
      (service as unknown as { maybePromoteReleasedOrderOnDate?: unknown })
        .maybePromoteReleasedOrderOnDate,
    ).toBeUndefined();
    expect(
      (service as unknown as { promoteDueReleasedOrders?: unknown }).promoteDueReleasedOrders,
    ).toBeUndefined();
  });
});
