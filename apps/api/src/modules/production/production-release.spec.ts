import { ProductionService } from './production.service';
import { BadRequestException } from '@nestjs/common';

function harness(overrides: Record<string, unknown> = {}) {
  const order = {
    id: 'po-1', salesOrderId: 'so-1', createdById: 'admin', status: 'PLANNED',
    releasedToFactoryAt: null, actualStartDate: null,
    plannedStartDate: new Date('2026-10-14T12:00:00Z'), tasks: [],
    readiness: { canStart: true, reasons: [] }, ...overrides,
  };
  const tx = {
    productionOrder: { update: jest.fn().mockResolvedValue({}) },
    salesOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = { $transaction: jest.fn(async (fn) => fn(tx)) };
  const pipeline = {
    unlockReadyStages: jest.fn().mockResolvedValue([]),
    rollupProgress: jest.fn().mockResolvedValue({ salesOrderId: 'so-1' }),
  };
  const scheduling = { generateForProductionOrder: jest.fn() };
  const handoff = { emitPipeline: jest.fn() };
  const service = new ProductionService(prisma as never, pipeline as never, {} as never,
    {} as never, scheduling as never, handoff as never);
  const read = jest.spyOn(service, 'getById').mockResolvedValue(order as never);
  const update = jest.spyOn(service, 'update').mockResolvedValue(order as never);
  return { service, prisma, tx, pipeline, scheduling, handoff, read, update, order };
}

describe('production plan confirmation releases to factory', () => {
  it('releases a ready planned order without starting work or a timer', async () => {
    const h = harness();
    await h.service.start('po-1', 'admin');
    expect(h.tx.productionOrder.update).toHaveBeenCalledWith({
      where: { id: 'po-1' }, data: {
        status: 'READY', releasedToFactoryAt: expect.any(Date), releasedToFactoryById: 'admin',
      },
    });
    expect(h.tx.salesOrder.updateMany.mock.calls[0][0].data.status).toBe('READY_FOR_PRODUCTION');
    expect(h.pipeline.unlockReadyStages).toHaveBeenCalledWith('po-1', h.tx);
    expect(h.tx.auditEvent.create.mock.calls[0][0].data.action).toBe('production-order.release-to-factory');
    expect(h.scheduling.generateForProductionOrder).not.toHaveBeenCalled();
  });

  it('rejects an incomplete plan without release writes', async () => {
    const h = harness({ readiness: { canStart: false, reasons: [{ code: 'MISSING_ASSIGNMENT' }] } });
    await expect(h.service.start('po-1', 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps material shortage advisory at release', async () => {
    const h = harness({ status: 'WAITING_FOR_MATERIALS', readiness: {
      canStart: true, reasons: [{ code: 'MATERIALS_HOLD' }],
    } });
    await h.service.start('po-1', 'admin');
    expect(h.tx.productionOrder.update.mock.calls[0][0].data.status).toBe('WAITING_FOR_MATERIALS');
    expect(h.tx.productionOrder.update.mock.calls[0][0].data.releasedToFactoryAt).toBeInstanceOf(Date);
  });

  it.each([
    { releasedToFactoryAt: new Date('2026-10-12T12:00:00Z') },
    { status: 'IN_PROGRESS' },
  ])('does not alter already released or legacy floor work: %j', async (state) => {
    const h = harness(state);
    await h.service.start('po-1', 'admin', '2026-10-15T12:00:00Z');
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect(h.scheduling.generateForProductionOrder).not.toHaveBeenCalled();
  });

  it('saves the chosen date without silently applying a new suggested schedule', async () => {
    const h = harness();
    await h.service.start('po-1', 'admin', '2026-10-15T12:00:00Z');
    expect(h.update).toHaveBeenCalledWith('po-1', { plannedStartDate: '2026-10-15T12:00:00Z' });
    expect(h.read).toHaveBeenCalledTimes(3);
    expect(h.scheduling.generateForProductionOrder).not.toHaveBeenCalled();
  });
});
