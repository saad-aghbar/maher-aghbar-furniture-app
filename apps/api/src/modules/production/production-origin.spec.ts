import { ProductionService } from './production.service';
import {
  inventoryLotOriginWhere,
  isPendingReturnLifecycle,
  isReturnOriginType,
  planAllowsWithoutLineSetup,
  productionOriginLabel,
  productionOriginWhere,
  returnWorkKind,
  pieceIdFromQuarantineSourceKey,
  returnIdFromQuarantineSourceKey,
  returnQuarantineSourceKey,
  RETURN_QUARANTINE_PREFIX,
} from './production-origin';
import type { PrismaService } from '../../common/prisma.service';
import type { StagePipelineService } from './stage-pipeline.service';
import type { AuthUser } from '@maher/types';

describe('productionOriginLabel', () => {
  it('labels return work and replacement, and leaves sales orders unlabeled', () => {
    expect(productionOriginLabel('RETURN_WORK')).toBe('RETURN WORK');
    expect(productionOriginLabel('REPLACEMENT')).toBe('REPLACEMENT');
    expect(productionOriginLabel('SALES_ORDER')).toBeNull();
    expect(productionOriginLabel('INTERNAL')).toBeNull();
    expect(productionOriginLabel(null)).toBeNull();
  });

  it('treats return work and replacement as return origins', () => {
    expect(isReturnOriginType('RETURN_WORK')).toBe(true);
    expect(isReturnOriginType('REPLACEMENT')).toBe(true);
    expect(isReturnOriginType('RETURN_RECOVERY')).toBe(true);
    expect(isReturnOriginType('SALES_ORDER')).toBe(false);
  });

  it('lets factory work and dismantle-recover save a plan without a sales-order line setup', () => {
    expect(planAllowsWithoutLineSetup({ originType: 'RETURN_WORK' })).toBe(true);
    expect(planAllowsWithoutLineSetup({ originType: 'RETURN_RECOVERY' })).toBe(true);
    expect(planAllowsWithoutLineSetup({ originType: 'REPLACEMENT' })).toBe(true);
    expect(planAllowsWithoutLineSetup({ originType: 'INTERNAL' })).toBe(true);
    expect(
      planAllowsWithoutLineSetup({ originType: 'SALES_ORDER', returnRequestId: 'ret-1' }),
    ).toBe(true);
    expect(planAllowsWithoutLineSetup({ originType: 'SALES_ORDER' })).toBe(false);
  });

  it('keeps RETURN_RECOVERY distinct from RETURN_WORK', () => {
    expect(returnWorkKind('RETURN_RECOVERY')).toBe('RETURN_RECOVERY');
    expect(returnWorkKind('REPLACEMENT')).toBe('REPLACEMENT');
    expect(returnWorkKind('RETURN_WORK')).toBe('RETURN_WORK');
    expect(returnWorkKind(null)).toBe('RETURN_WORK');
  });
});

describe('productionOriginWhere', () => {
  it('filters returned origins and leaves unset origin unscoped', () => {
    expect(productionOriginWhere('returned')).toEqual({
      originType: { in: ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] },
    });
    expect(productionOriginWhere('normal')).toEqual({
      originType: { notIn: ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] },
    });
    expect(productionOriginWhere(undefined)).toBeUndefined();
  });
});

describe('inventoryLotOriginWhere', () => {
  it('includes return-work POs and quarantine lots under returned', () => {
    expect(inventoryLotOriginWhere('returned')).toEqual({
      OR: [
        { productionOrder: { originType: { in: ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] } } },
        { sourceKey: { startsWith: RETURN_QUARANTINE_PREFIX } },
        { sourceKey: { startsWith: 'return-piece-quarantine:' } },
      ],
    });
  });

  it('excludes both under normal', () => {
    expect(inventoryLotOriginWhere('normal')).toEqual({
      NOT: {
        OR: [
          { productionOrder: { originType: { in: ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] } } },
          { sourceKey: { startsWith: RETURN_QUARANTINE_PREFIX } },
          { sourceKey: { startsWith: 'return-piece-quarantine:' } },
        ],
      },
    });
  });
});

describe('return helpers', () => {
  it('parses quarantine source keys', () => {
    expect(returnIdFromQuarantineSourceKey('return-quarantine:ret-1')).toBe('ret-1');
    expect(returnIdFromQuarantineSourceKey('rv-fg:x')).toBeNull();
    expect(pieceIdFromQuarantineSourceKey('return-piece-quarantine:p-1')).toBe('p-1');
    expect(returnQuarantineSourceKey({ pieceId: 'p-1' })).toBe('return-piece-quarantine:p-1');
    expect(returnQuarantineSourceKey({ returnId: 'ret-1' })).toBe('return-quarantine:ret-1');
  });

  it('treats completed, rejected, restock, and scrap as not pending', () => {
    expect(isPendingReturnLifecycle('REQUESTED')).toBe(true);
    expect(isPendingReturnLifecycle('REWORKING')).toBe(true);
    expect(isPendingReturnLifecycle('COMPLETED')).toBe(false);
    expect(isPendingReturnLifecycle('REJECTED')).toBe(false);
    expect(isPendingReturnLifecycle('RETURNED_TO_STOCK')).toBe(false);
    expect(isPendingReturnLifecycle('SCRAPPED')).toBe(false);
  });
});

describe('ProductionService.getById return-work origin', () => {
  const admin: AuthUser = {
    id: 'u-admin',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['production-order.read'],
    preferredLanguage: 'en',
  };

  const returnWorkOrder = {
    id: 'po-rw',
    number: 'RW-2026-0017',
    customerId: 'cust-1',
    salesOrderId: null,
    salesOrder: null,
    salesOrderLine: null,
    originType: 'RETURN_WORK',
    returnRequestId: 'ret-1',
    returnRequest: {
      id: 'ret-1',
      number: 'RT-1042',
      lifecycleState: 'REWORKING',
      salesOrder: { id: 'so-1', number: 'SO-1042' },
    },
    status: 'PLANNED',
    progressPercent: 0,
    requiredDeliveryDate: null,
    plannedStartDate: null,
    productId: null,
    product: null,
    productDescription: 'Return work — sofa',
    currentStageCode: null,
    stages: [],
    tasks: [],
    documents: [],
  };

  function makeService(prisma: PrismaService) {
    return new ProductionService(
      prisma,
      {} as StagePipelineService,
      { next: jest.fn().mockResolvedValue('TSK-1') } as never,
      {
        summaryForProductionOrder: jest.fn().mockResolvedValue(null),
      } as never,
      { generateForProductionOrder: jest.fn() } as never,
    );
  }

  it('exposes originLabel, original sales order, and orphan customer', async () => {
    const prisma = {
      productionOrder: {
        findFirst: jest.fn().mockResolvedValue(returnWorkOrder),
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-rw',
          quantity: 1,
          productDescription: 'Return work — sofa',
          status: 'PLANNED',
          stages: [],
        }),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      customer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cust-1',
          code: 'D-01',
          name: 'Aghbar Dealer',
          nameAr: null,
          nameEn: 'Aghbar Dealer',
          nameHe: null,
        }),
      },
      productionSchedule: { count: jest.fn().mockResolvedValue(0) },
      fabricProcurement: { findMany: jest.fn().mockResolvedValue([]) },
      qualityInspection: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const result = await makeService(prisma).getById('po-rw', admin);
    expect(result.originLabel).toBe('RETURN WORK');
    expect(result.returnRequest).toEqual({
      id: 'ret-1',
      number: 'RT-1042',
      lifecycleState: 'REWORKING',
      salesOrder: { id: 'so-1', number: 'SO-1042' },
    });
    expect(result.customer).toMatchObject({
      id: 'cust-1',
      nameEn: 'Aghbar Dealer',
    });
    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      select: {
        id: true,
        code: true,
        name: true,
        nameAr: true,
        nameEn: true,
        nameHe: true,
      },
    });
  });
});
