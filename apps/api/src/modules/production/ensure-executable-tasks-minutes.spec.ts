import { ProductionService } from './production.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';
import type { StagePipelineService } from './stage-pipeline.service';
import type { ManufacturingCostService } from './manufacturing-cost.service';
import type { SchedulingService } from '../scheduling/scheduling.service';

describe('ProductionService.ensureExecutableTasks minutes', () => {
  function makeService() {
    const create = jest.fn().mockResolvedValue({ id: 't1' });
    const findManySnap = jest.fn().mockResolvedValue([
      { stageInstanceId: 'si1', estimatedMinutes: 30 },
      { stageInstanceId: 'si2', estimatedMinutes: null },
    ]);
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          quantity: 2,
          productDescription: 'Sofa',
          status: 'PLANNED',
          stages: [
            {
              id: 'si1',
              stageDefinitionId: 'sd1',
              stageDefinition: {
                code: 'CARPENTRY',
                nameEn: 'Carpentry',
                executionKind: 'PRODUCTION',
              },
              tasks: [],
            },
            {
              id: 'si2',
              stageDefinitionId: 'sd2',
              stageDefinition: {
                code: 'UPHOLSTERY',
                nameEn: 'Upholstery',
                executionKind: 'PRODUCTION',
              },
              tasks: [],
            },
          ],
        }),
      },
      productionOrderWorkflowSnapshotNode: { findMany: findManySnap },
      productionTask: { create },
    };
    const sequences = {
      next: jest.fn().mockResolvedValueOnce('TSK-1').mockResolvedValueOnce('TSK-2'),
    };
    const service = new ProductionService(
      prisma as unknown as PrismaService,
      {} as StagePipelineService,
      sequences as unknown as SequenceService,
      {} as ManufacturingCostService,
      {} as SchedulingService,
    );
    return { service, create };
  }

  it('copies snapshot minutes and leaves the field unset when the stage has no time', async () => {
    const { service, create } = makeService();
    const result = await service.ensureExecutableTasks('po-1');
    expect(result.created).toBe(2);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          stageInstanceId: 'si1',
          estimatedMinutes: 30,
        }),
      }),
    );
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          stageInstanceId: 'si2',
          estimatedMinutes: undefined,
        }),
      }),
    );
    expect(create.mock.calls.some((c) => c[0]?.data?.estimatedMinutes === 120)).toBe(
      false,
    );
  });

  it('writes 0 minutes for inspection instead of leaving the field unset', async () => {
    const create = jest.fn().mockResolvedValue({ id: 't-insp' });
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          quantity: 1,
          productDescription: 'Sofa',
          status: 'PLANNED',
          stages: [
            {
              id: 'si-insp',
              stageDefinitionId: 'sd-insp',
              stageDefinition: {
                code: 'INSPECTION',
                nameEn: 'Inspection',
                executionKind: 'QUALITY',
              },
              tasks: [],
            },
          ],
        }),
      },
      productionOrderWorkflowSnapshotNode: {
        findMany: jest.fn().mockResolvedValue([
          { stageInstanceId: 'si-insp', estimatedMinutes: 35 },
        ]),
      },
      productionTask: { create },
    };
    const sequences = { next: jest.fn().mockResolvedValue('TSK-INSP') };
    const service = new ProductionService(
      prisma as unknown as PrismaService,
      {} as StagePipelineService,
      sequences as unknown as SequenceService,
      {} as ManufacturingCostService,
      {} as SchedulingService,
    );
    const result = await service.ensureExecutableTasks('po-1');
    expect(result.created).toBe(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stageInstanceId: 'si-insp',
          estimatedMinutes: 0,
        }),
      }),
    );
  });
});
