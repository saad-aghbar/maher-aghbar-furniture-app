import { BadRequestException } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import type { AuthUser } from '@maher/types';

describe('ReturnsService.createWorkOrder kind conflict', () => {
  const user: AuthUser = {
    id: 'admin-1',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['return.work'],
    preferredLanguage: 'en',
  };

  it('does not return a rework PO when a replacement is requested', async () => {
    const row = {
      id: 'ret-1',
      number: 'RET-1',
      productDesc: 'Sofa',
      quantity: 1,
      approvalStatus: 'APPROVED',
      receivedAt: new Date(),
      physicalStatus: 'RETURNED',
      lifecycleState: 'RECEIVED',
      productId: null,
      salesOrderLine: null,
      workOrders: [{ id: 'rw-1', number: 'RW-1', originType: 'RETURN_WORK' }],
    };
    const service = new ReturnsService(
      {
        returnRequest: { findUnique: jest.fn().mockResolvedValue(row) },
        auditEvent: { create: jest.fn() },
      } as never,
      { next: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.createWorkOrder('ret-1', user, { kind: 'REPLACEMENT' })).rejects.toMatchObject({
      response: { code: 'RETURN_WORK_KIND_CONFLICT' },
    });
    await expect(service.createWorkOrder('ret-1', user, { kind: 'REPLACEMENT' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns the existing same-kind work order', async () => {
    const existing = { id: 'rp-1', number: 'RP-1', originType: 'REPLACEMENT' };
    const service = new ReturnsService(
      {
        returnRequest: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ret-1',
            approvalStatus: 'APPROVED',
            receivedAt: new Date(),
            physicalStatus: 'RETURNED',
            lifecycleState: 'RECEIVED',
            workOrders: [existing],
          }),
        },
      } as never,
      { next: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.createWorkOrder('ret-1', user, { kind: 'REPLACEMENT' })).resolves.toEqual({
      productionOrder: existing,
      created: false,
    });
  });
});
