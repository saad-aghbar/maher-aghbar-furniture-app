import { BadRequestException } from '@nestjs/common';
import { ManufacturingComplexity, SalesOrderLineSetupStatus } from '@maher/database';
import { OrderProductionSetupService } from './order-production-setup.service';

describe('Custom ensure-plan and seed guards', () => {
  const staff = { id: 'admin-1', customerId: null } as never;

  function makeService() {
    const customLine = {
      id: 'ls-custom',
      salesOrderLineId: 'line-custom',
      manufacturingName: 'Custom sofa',
      manufacturingComplexity: ManufacturingComplexity.CUSTOM,
      workflowId: null,
      workflowConfirmedAt: null,
      materialRequirements: [],
      status: SalesOrderLineSetupStatus.NEEDS_REVIEW,
      workflow: null,
    };
    const setup = {
      id: 'setup-custom',
      salesOrderId: 'so-custom',
      status: 'SETUP_IN_PROGRESS',
      lines: [customLine],
    };
    const soLine = {
      id: 'line-custom',
      description: 'Custom sofa',
      quantity: 1,
      productId: null,
      manufacturingComplexity: ManufacturingComplexity.CUSTOM,
      orderSpec: {},
      product: null,
    };
    const prisma: any = {
      salesOrderProductionSetup: {
        findUnique: jest.fn().mockResolvedValue(setup),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...setup,
          lines: [
            {
              ...customLine,
              salesOrderLine: {
                id: 'line-custom',
                description: 'Custom sofa',
                manufacturingComplexity: ManufacturingComplexity.CUSTOM,
                product: null,
              },
            },
          ],
        }),
        update: jest.fn(),
      },
      salesOrderLine: {
        findUnique: jest.fn().mockResolvedValue(soLine),
      },
      salesOrderLineSetup: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          manufacturingName: 'Custom sofa',
          workflowId: null,
          workflowConfirmedAt: null,
        }),
        findMany: jest.fn().mockResolvedValue([{ workflowId: null }]),
        update: jest.fn(),
      },
      productionOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      productionOrderWorkflowSnapshotNode: { count: jest.fn().mockResolvedValue(0) },
      auditEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    const service = new OrderProductionSetupService(
      prisma,
      { next: jest.fn() } as never,
      {
        createSnapshotForProductionOrder: jest.fn().mockResolvedValue(null),
        assignWorkflowToProductionOrder: jest.fn(),
      } as never,
      { tryReserveForSalesOrder: jest.fn() } as never,
      { notifyCustomerUsers: jest.fn() } as never,
    );
    return { service, prisma };
  }

  function responseOf(err: unknown) {
    return (err as BadRequestException).getResponse() as { code?: string };
  }

  it('ensurePlanOrders creates a draft PO when Custom has no productId or workflow', async () => {
    const { service, prisma } = makeService();
    jest.spyOn(service, 'ensureSetup').mockResolvedValue({} as never);
    const releaseSpy = jest.spyOn(service, 'release').mockResolvedValue({
      productionOrderIds: ['po-custom'],
    } as never);

    const result = await service.ensurePlanOrders('so-custom', staff);

    expect(result.created).toBe(true);
    expect(result.primaryProductionOrderId).toBe('po-custom');
    expect(releaseSpy).toHaveBeenCalledWith('so-custom', staff, { forPlanOpen: true });
    expect(prisma.salesOrderLineSetup.update).toHaveBeenCalled();
    const seedSpyCalls = (service.seedFromCatalog as jest.Mock | undefined)?.mock?.calls ?? [];
    expect(seedSpyCalls).toEqual([]);
  });

  it('ensureSetup seed data for a null productId is CUSTOM with no workflow or materials', () => {
    const { service } = makeService();
    const seeded = (service as any).seedLineCreateData(
      {
        id: 'line-custom',
        description: 'Custom sofa',
        manufacturingComplexity: ManufacturingComplexity.CUSTOM,
        orderSpec: {},
        productId: null,
        product: null,
      },
      [],
      false,
    );
    expect(seeded.manufacturingComplexity).toBe(ManufacturingComplexity.CUSTOM);
    expect(seeded.workflow).toBeUndefined();
    expect(seeded.materialRequirements).toBeUndefined();
  });

  it('seedFromCatalog still rejects Custom with CUSTOM_NO_TEMPLATE', async () => {
    const { service, prisma } = makeService();
    try {
      await service.seedFromCatalog('so-custom', 'line-custom', staff);
      throw new Error('expected reject');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(responseOf(err).code).toBe('CUSTOM_NO_TEMPLATE');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
