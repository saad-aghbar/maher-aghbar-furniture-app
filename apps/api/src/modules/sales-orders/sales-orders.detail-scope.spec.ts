import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { SalesOrdersService } from './sales-orders.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';

const DEALER_LEAK_KEYS = [
  'manufacturingCost',
  'costBreakdown',
  'costMaterialLines',
  'productionPrice',
  'profit',
  'manufacturingCosting',
  'assignedEmployeeId',
  'assignedEmployee',
  'bomDefaults',
  'currentStageCode',
  'currentStage',
  'endCustomerName',
  'endCustomerPhone',
];

const DEALER_STAGE_FORBIDDEN = new Set([
  'assignees',
  'blockers',
  'notes',
  'attachmentCount',
  'isOverdue',
  'actualStart',
  'actualEnd',
  'plannedEnd',
]);

const DEALER_STAGE_ALLOWED = new Set([
  'code',
  'nameEn',
  'nameAr',
  'nameHe',
  'sortOrder',
  'dependsOnCodes',
  'status',
  'progressPercent',
  'photos',
]);

function assertNoDealerLeaks(value: unknown, path = 'root'): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoDealerLeaks(item, `${path}[${i}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DEALER_LEAK_KEYS.includes(key)) {
      throw new Error(`Leak field "${key}" at ${path}`);
    }
    if (key === 'photos' && Array.isArray(child) && path.includes('productionOrders') && !path.includes('stages')) {
      if (child.length > 0) {
        throw new Error(`Non-empty PO-level task photos at ${path}`);
      }
      continue;
    }
    if (key === 'stages' && Array.isArray(child)) {
      for (let i = 0; i < child.length; i += 1) {
        const stage = child[i];
        if (!stage || typeof stage !== 'object') continue;
        for (const sk of Object.keys(stage as object)) {
          if (DEALER_STAGE_FORBIDDEN.has(sk) || !DEALER_STAGE_ALLOWED.has(sk)) {
            throw new Error(`Forbidden stage field "${sk}" at ${path}.stages[${i}]`);
          }
        }
      }
      continue;
    }
    assertNoDealerLeaks(child, `${path}.${key}`);
  }
}

describe('SalesOrdersService.getById ownership', () => {
  const dealerA: AuthUser = {
    id: 'user-a',
    username: 'cedar',
    email: 'a@example.com',
    name: 'Cedar',
    roles: ['CUSTOMER'],
    permissions: ['sales-order.read'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
  };

  const admin: AuthUser = {
    id: 'admin',
    username: 'admin',
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMIN'],
    permissions: ['sales-order.read'],
    preferredLanguage: 'en',
  };

  function sampleOrder(customerId: string) {
    return {
      id: 'so-1',
      number: 'ORD-1',
      customerId,
      status: 'IN_PRODUCTION',
      priority: 'HIGH',
      assignedEmployeeId: 'worker-1',
      notes: 'Handle with care',
      externalOrderNumber: 'PO-88',
      total: 1000,
      deliveryAddress: 'Amman',
      requiredDeliveryDate: new Date('2026-08-20'),
      projectName: null,
      customer: { id: customerId, name: 'Cedar' },
      quotation: {
        id: 'q1',
        number: 'Q1',
        status: 'ACCEPTED',
        customerNotes: null,
        request: {
          id: 'r1',
          number: 'R1',
          status: 'APPROVED',
          source: 'PORTAL',
          notes: 'RFQ notes',
          projectName: null,
          contactName: null,
          deliveryAddress: null,
          requiredDeliveryDate: null,
          externalOrderNumber: 'PO-88',
          endCustomerName: 'Secret End Customer',
          endCustomerPhone: '000',
          endCustomerFax: null,
          deliveryLat: null,
          deliveryLng: null,
          priority: 'NORMAL',
          createdAt: new Date(),
          items: [
            {
              id: 'i1',
              productName: 'Sofa',
              description: null,
              quantity: 1,
              unit: 'pcs',
              width: null,
              height: null,
              depth: null,
              material: null,
              fabricType: 'Linen',
              fabricColor: 'Beige',
              woodType: null,
              foamDensity: null,
              finish: null,
              accessories: null,
              notes: null,
              customMeasurements: null,
              fabricCode: 'F-1',
            },
          ],
          documents: [
            {
              id: 'd1',
              fileName: 'sketch.png',
              mimeType: 'image/png',
              storageKey: 'k1',
              category: 'CUSTOMER_VISIBLE',
              createdAt: new Date(),
            },
          ],
          aiJobs: [],
        },
      },
      lines: [
        {
          id: 'l1',
          description: 'Sofa',
          specifications: null,
          quantity: 1,
          unitPrice: 1000,
          lineTotal: 1000,
          product: {
            id: 'p1',
            sku: 'S1',
            nameEn: 'Sofa',
            nameAr: null,
            nameHe: null,
            imageUrl: 'https://example.com/sofa.png',
            manufacturingCost: 400,
            basePrice: 900,
            bomDefaults: {},
          },
        },
      ],
      productionOrders: [
        {
          id: 'po1',
          number: 'PO-1',
          status: 'IN_PROGRESS',
          currentStageCode: 'UPHOLSTERY',
          progressPercent: 60,
          stages: [
            {
              status: 'DONE',
              progressPercent: 100,
              actualStart: null,
              actualEnd: null,
              plannedEnd: null,
              notes: null,
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
                    id: 'worker-1',
                    firstName: 'Ali',
                    lastName: 'Hassan',
                  },
                  blockers: [],
                  notes: null,
                },
              ],
            },
          ],
          documents: [
            {
              id: 'ph1',
              fileName: 'task.jpg',
              mimeType: 'image/jpeg',
              category: 'TASK_PHOTO:UPHOLSTERY',
              createdAt: new Date(),
            },
          ],
        },
      ],
      invoices: [{ id: 'inv1', number: 'INV-1', status: 'ISSUED', total: 1000, outstandingAmount: 500 }],
      deliveries: [],
      returns: [
        {
          id: 'ret1',
          number: 'RET-1',
          approvalStatus: 'PENDING',
          reason: 'Damage',
          productDesc: 'Sofa',
          quantity: 1,
          createdAt: new Date(),
        },
      ],
    };
  }

  function makeService(order: ReturnType<typeof sampleOrder> | null) {
    const findFirst = jest.fn().mockResolvedValue(order);
    const update = jest.fn().mockResolvedValue({});
    const userFindUnique = jest.fn().mockResolvedValue({
      id: 'worker-1',
      firstName: 'Ali',
      lastName: 'Hassan',
    });

    const prisma = {
      salesOrder: { findFirst, update },
      user: { findUnique: userFindUnique },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      dealerPrice: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const service = new SalesOrdersService(
      prisma as unknown as PrismaService,
      {} as SequenceService,
      {
        sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }),
        notifyAdminUsers: jest.fn().mockResolvedValue({ ok: true }),
        notifyCustomerUsers: jest.fn().mockResolvedValue({ ok: true }),
      } as any,
      { createAccessToken: jest.fn(() => 'tok') } as any,
      {
        generateForProductionOrder: jest.fn().mockResolvedValue(undefined),
      } as any,
      { createSnapshotForProductionOrder: jest.fn() } as any,
      { tryReserveForSalesOrder: jest.fn(), releaseForSalesOrder: jest.fn() } as any,
      { onProductionOrdersCancelled: jest.fn() } as any,
      { ensureSetup: jest.fn(), isReleased: jest.fn().mockResolvedValue(false) } as any,
      {
        summaryForSalesOrder: jest.fn().mockResolvedValue(null),
      } as any,
    );
    jest.spyOn(service, 'hydrateLineProducts').mockImplementation(async (lines) => lines as never);
    jest.spyOn(service, 'loadDealerPrices').mockResolvedValue(new Map());
    jest.spyOn(service, 'loadMaterialCosts').mockResolvedValue(new Map());
    jest.spyOn(service, 'costsForLines').mockReturnValue({
      sellerPrice: 1000,
      productionPrice: 400,
      manufacturingCost: 400,
      profit: 600,
      costBreakdown: { woodCost: 100 },
    } as never);

    return { service, findFirst, userFindUnique };
  }

  it('forbids dealer A from reading dealer B order', async () => {
    const { service } = makeService(sampleOrder('customer-b'));
    await expect(service.getById('so-1', dealerA)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps dealer-safe stages and strips costs, worker, and end-customer for dealer owner', async () => {
    const { service } = makeService(sampleOrder('customer-a'));
    const result = await service.getById('so-1', dealerA);
    expect(result.sellerPrice).toBe(1000);
    expect(result.progressPercent).toBeDefined();
    const stages = (result.productionOrders as { stages: Record<string, unknown>[] }[])[0]!
      .stages;
    expect(stages.length).toBeGreaterThan(0);
    expect(stages[0]).toMatchObject({
      code: 'CUT',
      status: 'DONE',
      progressPercent: 100,
    });
    expect(stages[0]).not.toHaveProperty('assignees');
    expect(stages[0]).not.toHaveProperty('blockers');
    assertNoDealerLeaks(result);
  });

  it('keeps costs, enriched stages, and assigned worker for admin', async () => {
    const { service } = makeService(sampleOrder('customer-a'));
    const result = await service.getById('so-1', admin) as Record<string, unknown>;
    expect(result.manufacturingCost).toBe(400);
    expect(result.profit).toBe(600);
    expect(result.assignedEmployee).toEqual({ id: 'worker-1', name: 'Ali Hassan' });
    const pos = result.productionOrders as { stages: Record<string, unknown>[]; photos: unknown[] }[];
    expect(pos[0]!.stages.length).toBeGreaterThan(0);
    expect(pos[0]!.stages[0]).toHaveProperty('assignees');
    expect(pos[0]!.photos.length).toBeGreaterThan(0);
  });
});
