import {
  selectProductionJourney,
  selectProductionWhereNow,
} from '../selectProductionJourney';
import type { ProductionOrderDetail } from '../api';

const order: ProductionOrderDetail = {
  id: 'po-1',
  number: 'PO-100',
  status: 'IN_PROGRESS',
  priority: 'NORMAL',
  progressPercent: 40,
  productDescription: 'Sofa',
  actualStartDate: '2026-09-01T08:00:00.000Z',
  plannedStartDate: '2026-09-01T00:00:00.000Z',
  releasedToFactoryAt: '2026-08-28T00:00:00.000Z',
  salesOrder: { id: 'so-1', number: 'SO-9' },
  currentStage: { code: 'ASM', nameEn: 'Assembly' },
  stages: [
    {
      code: 'CUT',
      nameEn: 'Cutting',
      sortOrder: 1,
      status: 'COMPLETED',
      actualStart: '2026-09-01T08:00:00.000Z',
      actualEnd: '2026-09-01T09:00:00.000Z',
      plannedEnd: '2026-09-01T10:00:00.000Z',
      assignees: [{ id: 'w1', name: 'Ahmad' }],
      dependsOnCodes: [],
    },
    {
      code: 'ASM',
      nameEn: 'Assembly',
      sortOrder: 2,
      status: 'IN_PROGRESS',
      actualStart: '2026-09-01T09:10:00.000Z',
      assignees: [{ id: 'w2', name: 'Omar' }],
      dependsOnCodes: ['CUT'],
    },
    {
      code: 'UPH',
      nameEn: 'Upholstery',
      sortOrder: 3,
      status: 'PENDING',
      dependsOnCodes: ['ASM'],
      backForRework: true,
    },
    {
      code: 'INSPECTION',
      nameEn: 'Inspection',
      sortOrder: 4,
      status: 'IN_PROGRESS',
      dependsOnCodes: ['UPH'],
    },
  ],
  tasks: [],
};

describe('selectProductionJourney / whereNow', () => {
  it('builds journey stages with workers and bookends from API', () => {
    const journey = selectProductionJourney(order, 'en');
    expect(journey).toHaveLength(4);
    expect(journey[0]?.name).toBe('Cutting');
    expect(journey[0]?.assigneeName).toBe('Ahmad');
    expect(journey[0]?.timing).toBe('on_time');
    expect(journey[1]?.status).toBe('IN_PROGRESS');
    expect(journey[2]?.status).toBe('PENDING');
    expect(journey[2]?.backForRework).toBe(true);
    expect(journey[3]?.inspectionProgress ?? null).toBeNull();
  });

  it('answers where-now from current stage and workers', () => {
    const where = selectProductionWhereNow(order, 'en', {
      dealerName: 'Oasis',
      productTitle: 'Sofa',
      imageUrl: null,
      deliveryLabel: '20 Sep',
      progressLabel: 'Assembly',
      attentionCount: 1,
    });
    expect(where.currentStageName).toBe('Assembly');
    expect(where.currentWorkStatus).toBe('IN_PROGRESS');
    expect(where.activeWorkerName).toBe('Omar');
    expect(where.completedStageNames).toContain('Cutting');
    expect(where.waitingStageNames).toContain('Upholstery');
    expect(where.plannedVsActualLabel).toBe('on_track');
    expect(where.salesOrderNumber).toBe('SO-9');
    expect(where.inspectionNext).toBe(false);
  });

  it('names a not-started task instead of calling inspection next', () => {
    const finished: ProductionOrderDetail = {
      ...order,
      currentStage: null,
      progressPercent: 100,
      stages: [
        {
          code: 'CARPENTRY',
          nameEn: 'Carpentry',
          status: 'COMPLETED',
          tasks: [{ id: 'carp', number: 'TSK-1', name: 'Carpentry', status: 'NOT_STARTED' }],
        },
        {
          code: 'FOAM',
          nameEn: 'Foam preparation',
          status: 'COMPLETED',
          tasks: [{ id: 'foam', number: 'TSK-2', name: 'Foam', status: 'COMPLETED' }],
        },
      ],
    };
    const journey = selectProductionJourney(finished, 'en');
    expect(journey[0]?.status).toBe('NOT_STARTED');
    expect(journey[1]?.status).toBe('COMPLETED');
    const where = selectProductionWhereNow(finished, 'en', {
      dealerName: null,
      productTitle: 'Chair',
      imageUrl: null,
      deliveryLabel: null,
      progressLabel: null,
      attentionCount: 0,
    });
    expect(where.currentStageName).toBe('Carpentry');
    expect(where.currentWorkStatus).toBe('NOT_STARTED');
    expect(where.inspectionNext).toBe(false);
    expect(where.completedStageNames).toEqual(['Foam preparation']);
  });

  it('calls inspection next only after every manufacturing task is completed', () => {
    const finished: ProductionOrderDetail = {
      ...order,
      currentStage: null,
      stages: [
        {
          code: 'CARPENTRY',
          nameEn: 'Carpentry',
          status: 'COMPLETED',
          tasks: [{ id: 'carp', number: 'TSK-1', name: 'Carpentry', status: 'COMPLETED' }],
        },
        {
          code: 'FOAM',
          nameEn: 'Foam preparation',
          status: 'COMPLETED',
          tasks: [{ id: 'foam', number: 'TSK-2', name: 'Foam', status: 'COMPLETED' }],
        },
      ],
    };
    const where = selectProductionWhereNow(finished, 'en', {
      dealerName: null,
      productTitle: 'Chair',
      imageUrl: null,
      deliveryLabel: null,
      progressLabel: null,
      attentionCount: 0,
    });
    expect(where.currentWorkStatus).toBeNull();
    expect(where.inspectionNext).toBe(true);
  });
});
