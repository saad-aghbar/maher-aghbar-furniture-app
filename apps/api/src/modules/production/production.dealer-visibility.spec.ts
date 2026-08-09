import { ProductionService } from './production.service';
import type { PrismaService } from '../../common/prisma.service';
import type { StagePipelineService } from './stage-pipeline.service';
import type { AuthUser } from '@maher/types';

describe('ProductionService dealer visibility', () => {
  const order = {
    id: 'po-1',
    customerId: 'cust-1',
    status: 'IN_PROGRESS',
    progressPercent: 55,
    requiredDeliveryDate: null,
    salesOrder: {
      customer: { id: 'cust-1', nameEn: 'Dealer' },
    },
    product: { imageUrl: 'img.png' },
    stages: [
      {
        id: 's1',
        status: 'IN_PROGRESS',
        progressPercent: 40,
        actualStart: null,
        actualEnd: null,
        plannedEnd: null,
        notes: 'floor note',
        stageDefinition: {
          code: 'CUT',
          nameEn: 'Cutting',
          nameAr: 'قص',
          nameHe: null,
          sortOrder: 1,
          dependsOnCodes: [],
        },
        tasks: [
          {
            assignedEmployee: {
              id: 'w1',
              firstName: 'Ali',
              lastName: 'Hassan',
            },
            blockers: [{ id: 'b1', category: 'MATERIAL', reason: 'Wood', resolvedAt: null }],
            notes: null,
          },
        ],
      },
    ],
    tasks: [
      {
        id: 't1',
        name: 'Cut',
        number: 'T1',
        blockers: [],
      },
    ],
    documents: [{ id: 'd1' }],
  };

  it('returns dealer-safe stages and strips tasks/blockers/documents', async () => {
    const prisma = {
      productionOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const service = new ProductionService(prisma, {} as StagePipelineService);
    const dealer: AuthUser = {
      id: 'u-dealer',
      username: 'dealer',
      email: 'd@x.com',
      name: 'Dealer',
      roles: ['CUSTOMER'],
      permissions: ['production-order.read'],
      preferredLanguage: 'en',
      customerId: 'cust-1',
    };

    const result = await service.getById('po-1', dealer);
    expect(result.progressPercent).toBe(55);
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0]).toMatchObject({
      code: 'CUT',
      status: 'IN_PROGRESS',
      progressPercent: 40,
    });
    expect(result.stages[0]).not.toHaveProperty('assignees');
    expect(result.stages[0]).not.toHaveProperty('blockers');
    expect(result.stages[0]).not.toHaveProperty('notes');
    expect(result.tasks).toEqual([]);
    expect(result.openBlockers).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  it('keeps tasks and enriched stages for admin (assignment surface)', async () => {
    const prisma = {
      productionOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const service = new ProductionService(prisma, {} as StagePipelineService);
    const admin: AuthUser = {
      id: 'u-admin',
      username: 'admin',
      email: 'a@x.com',
      name: 'Admin',
      roles: ['SYSTEM_ADMINISTRATOR'],
      permissions: ['production-order.read', 'production-order.assign'],
      preferredLanguage: 'en',
    };

    const result = await service.getById('po-1', admin);
    expect(result.tasks).toHaveLength(1);
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0]).toMatchObject({
      code: 'CUT',
      assignees: [{ id: 'w1', name: 'Ali Hassan' }],
    });
    expect((result.stages[0] as { blockers?: unknown[] }).blockers).toHaveLength(1);
  });
});
