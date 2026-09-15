import { NotificationsService } from './notifications.service';
import { notificationEventId } from '@maher/notifications';

function createPrisma(opts: { duplicateSecond?: boolean } = {}) {
  let created = 0;
  return {
    notificationTemplate: {
      findUnique: jest.fn().mockResolvedValue({
        code: 'ORDER_CONFIRMED',
        channel: 'IN_APP',
        subjectAr: 'تأكيد',
        subjectEn: 'Confirmed',
        subjectHe: 'אושר',
        bodyAr: 'تم تأكيد {{number}}',
        bodyEn: 'Confirmed {{number}}',
        bodyHe: 'אושר {{number}}',
      }),
    },
    notification: {
      create: jest.fn().mockImplementation(async () => {
        created += 1;
        if (opts.duplicateSecond && created > 1) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        return { id: `n-${created}` };
      }),
    },
    user: { findMany: jest.fn() },
    userNotificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  };
}

describe('emit idempotency', () => {
  it('same eventId does not create a second inbox row', async () => {
    const prisma = createPrisma({ duplicateSecond: true });
    const outbox = { enqueue: jest.fn().mockResolvedValue({ duplicate: false }) };
    const recipients = {
      resolve: jest.fn().mockResolvedValue([
        { id: 'u1', preferredLanguage: 'en', roles: ['SYSTEM_ADMINISTRATOR'], permissions: [], customerId: null },
      ]),
      isTopicOn: jest.fn().mockResolvedValue(true),
    };
    const svc = new NotificationsService(
      prisma as never,
      recipients as never,
      outbox as never,
      { send: jest.fn() } as never,
      { send: jest.fn() } as never,
      { send: jest.fn() } as never,
    );
    const eventId = notificationEventId({
      topic: 'order.confirmed',
      entityType: 'salesOrder',
      entityId: 'so-1',
      transition: 'CONFIRMED:1',
    });
    await svc.emit({
      topic: 'order.confirmed',
      eventId,
      entity: { type: 'salesOrder', id: 'so-1', number: 'SO-1' },
      linkUrl: '/sales-orders/so-1',
    });
    const second = await svc.emit({
      topic: 'order.confirmed',
      eventId,
      entity: { type: 'salesOrder', id: 'so-1', number: 'SO-1' },
      linkUrl: '/sales-orders/so-1',
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(second.count).toBe(0);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('a new transition remains notify-able', async () => {
    const prisma = createPrisma();
    const outbox = { enqueue: jest.fn().mockResolvedValue({ duplicate: false }) };
    const recipients = {
      resolve: jest.fn().mockResolvedValue([
        { id: 'u1', preferredLanguage: 'en', roles: ['SYSTEM_ADMINISTRATOR'], permissions: [], customerId: null },
      ]),
      isTopicOn: jest.fn().mockResolvedValue(true),
    };
    const svc = new NotificationsService(
      prisma as never,
      recipients as never,
      outbox as never,
      { send: jest.fn() } as never,
      { send: jest.fn() } as never,
      { send: jest.fn() } as never,
    );
    await svc.emit({
      topic: 'order.onHold',
      eventId: notificationEventId({
        topic: 'order.onHold',
        entityType: 'salesOrder',
        entityId: 'so-1',
        transition: 'ON_HOLD:1',
      }),
      entity: { type: 'salesOrder', id: 'so-1', number: 'SO-1' },
      linkUrl: '/sales-orders/so-1',
    });
    await svc.emit({
      topic: 'order.onHold',
      eventId: notificationEventId({
        topic: 'order.onHold',
        entityType: 'salesOrder',
        entityId: 'so-1',
        transition: 'ON_HOLD:2',
      }),
      entity: { type: 'salesOrder', id: 'so-1', number: 'SO-1' },
      linkUrl: '/sales-orders/so-1',
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(outbox.enqueue).toHaveBeenCalledTimes(2);
  });
});
