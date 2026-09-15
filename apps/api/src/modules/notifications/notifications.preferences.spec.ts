import { BadRequestException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import type { AuthUser } from '@maher/types';

describe('PUT /notifications/preferences eligibility', () => {
  const warehouse: AuthUser = {
    id: 'wh-1',
    username: 'warehouse',
    email: 'wh@x',
    name: 'Warehouse',
    roles: ['WAREHOUSE_MANAGEMENT'],
    permissions: ['inventory.read', 'inventory.receive', 'notification.read'],
    preferredLanguage: 'en',
  };

  function make() {
    const prisma = {
      userPushSettings: { upsert: jest.fn() },
      userNotificationPreference: { upsert: jest.fn() },
    };
    const devices = { setPushEnabled: jest.fn() };
    const ctrl = new NotificationsController(prisma as never, devices as never);
    return { ctrl, prisma };
  }

  it('rejects an ineligible topic instead of storing it', async () => {
    const { ctrl, prisma } = make();
    await expect(
      ctrl.putPreferences({ topics: { 'invoice.overdue': true } }, warehouse),
    ).rejects.toBeInstanceOf(BadRequestException);
    try {
      await ctrl.putPreferences({ topics: { 'invoice.overdue': true } }, warehouse);
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'TOPIC_NOT_ELIGIBLE',
        topics: ['invoice.overdue'],
      });
    }
    expect(prisma.userNotificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('rejects unknown topic codes', async () => {
    const { ctrl } = make();
    await expect(
      ctrl.putPreferences({ topics: { 'not.a.topic': true } }, warehouse),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores an eligible inventory topic', async () => {
    const { ctrl, prisma } = make();
    await expect(
      ctrl.putPreferences({ topics: { 'inventory.lowStock': false } }, warehouse),
    ).resolves.toEqual({ ok: true });
    expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_topic: { userId: 'wh-1', topic: 'inventory.lowStock' } },
        create: { userId: 'wh-1', topic: 'inventory.lowStock', enabled: false },
      }),
    );
  });
});
