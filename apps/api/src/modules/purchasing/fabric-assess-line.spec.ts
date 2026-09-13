import { FabricProcurementService } from './fabric-procurement.service';

describe('fabric assessForProductionOrder line isolation', () => {
  it('lists fabric for that PO line, not sibling lines on the same sales order', async () => {
    const list = jest.fn().mockResolvedValue([
      { readiness: { procurementId: 'fab-line-1', ready: true } },
    ]);
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-2',
          salesOrderId: 'so-1',
          salesOrderLineId: 'line-2',
        }),
      },
    };
    const svc = Object.create(FabricProcurementService.prototype) as FabricProcurementService;
    Object.assign(svc, { prisma, list });
    const result = await svc.assessForProductionOrder('po-2');
    expect(prisma.productionOrder.findUnique).toHaveBeenCalledWith({
      where: { id: 'po-2' },
      select: { salesOrderId: true, salesOrderLineId: true, id: true },
    });
    expect(list).toHaveBeenCalledWith({ salesOrderLineId: 'line-2' });
    expect(list).not.toHaveBeenCalledWith({ salesOrderId: 'so-1' });
    expect(result).toHaveLength(1);
  });
});
