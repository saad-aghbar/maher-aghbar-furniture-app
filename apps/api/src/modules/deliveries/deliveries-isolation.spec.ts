import { NotFoundException } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller';

function makeController() {
  const prisma = {
    delivery: { findUnique: jest.fn() },
    notificationTemplate: { findUnique: jest.fn() },
    salesOrder: { findUnique: jest.fn() },
  } as any;
  const notifications = { notifyCustomerUsers: jest.fn() };
  const ctrl = new DeliveriesController(
    prisma,
    {} as any,
    {} as any,
    notifications as any,
    {} as any,
  );
  return { ctrl, prisma };
}

describe('GET /deliveries/:id isolation', () => {
  it('404s when Dealer A requests Dealer B delivery', async () => {
    const { ctrl, prisma } = makeController();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'del-b',
      customerId: 'customer-b',
      driver: { id: 'drv-1', firstName: 'Sam' },
    });
    await expect(
      ctrl.get('del-b', {
        id: 'user-a',
        customerId: 'customer-a',
        permissions: ['delivery.read'],
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('strips driver for customer users on their own delivery', async () => {
    const { ctrl, prisma } = makeController();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'del-a',
      customerId: 'customer-a',
      number: 'DEL-1',
      driver: { id: 'drv-1', firstName: 'Sam' },
      items: [],
    });
    const result = (await ctrl.get('del-a', {
      id: 'user-a',
      customerId: 'customer-a',
      permissions: ['delivery.read'],
    } as any)) as Record<string, unknown>;
    expect(result.id).toBe('del-a');
    expect(result.driver).toBeUndefined();
  });
});
