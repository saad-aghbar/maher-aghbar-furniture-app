import { BadRequestException } from '@nestjs/common';
import { OrderPlanSetupService } from './order-plan-setup.service';

describe('OrderPlanSetupService.putPlanSetup return origins', () => {
  const staff = { id: 'admin-1', customerId: null } as never;

  function po(over: Record<string, unknown>) {
    return {
      id: 'po-1',
      originType: 'SALES_ORDER',
      returnRequestId: null,
      salesOrderLineId: null,
      salesOrderLine: null,
      releasedToFactoryAt: null,
      actualStartDate: null,
      status: 'PLANNED',
      workflowSnapshot: {
        id: 'snap-1',
        sourceWorkflowId: 'wf-1',
        nodes: [{ id: 'n1', sourceWorkflowNodeId: 'wn1' }],
      },
      ...over,
    };
  }

  function serviceWith(row: ReturnType<typeof po>) {
    const prisma = {
      productionOrder: { findFirst: jest.fn().mockResolvedValue(row) },
      auditEvent: { create: jest.fn() },
    };
    const service = new OrderPlanSetupService(prisma as never);
    jest.spyOn(service, 'getPlanSetup').mockResolvedValue({ id: row.id } as never);
    return { service, prisma };
  }

  it('rejects a normal sales-order plan when the line setup is missing', async () => {
    const { service } = serviceWith(po({}));
    await expect(service.putPlanSetup('po-1', {}, staff)).rejects.toMatchObject({
      response: { code: 'SETUP_REQUIRED' },
    });
    await expect(service.putPlanSetup('po-1', {}, staff)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(['RETURN_WORK', 'RETURN_RECOVERY', 'REPLACEMENT'] as const)(
    'saves a %s plan without a sales-order line setup',
    async (originType) => {
      const { service, prisma } = serviceWith(
        po({ originType, returnRequestId: 'ret-1' }),
      );
      await expect(service.putPlanSetup('po-1', {}, staff)).resolves.toEqual({ id: 'po-1' });
      expect(prisma.auditEvent.create).toHaveBeenCalled();
    },
  );
});
