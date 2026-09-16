import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import type { AuthUser } from '@maher/types';
import { ROLE_PERMISSIONS } from '@maher/permissions';

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

  const worker: AuthUser = {
    id: 'w-1',
    username: 'carpenter',
    email: 'w@x',
    name: 'Carpenter',
    roles: ['PRODUCTION_WORKER'],
    permissions: [...ROLE_PERMISSIONS.PRODUCTION_WORKER],
    preferredLanguage: 'en',
    stageSkillCodes: ['CARPENTRY'],
  };

  const dealer: AuthUser = {
    id: 'd-1',
    username: 'dealer',
    email: 'd@x',
    name: 'Dealer',
    roles: ['CUSTOMER'],
    permissions: [...ROLE_PERMISSIONS.CUSTOMER],
    preferredLanguage: 'en',
    customerId: 'cust-1',
  };

  const admin: AuthUser = {
    id: 'a-1',
    username: 'admin',
    email: 'a@x',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['notification.read'],
    preferredLanguage: 'en',
  };

  function make() {
    const prisma = {
      userPushSettings: { upsert: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
      userNotificationPreference: { upsert: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      notification: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const devices = { setPushEnabled: jest.fn(), getForUser: jest.fn().mockResolvedValue(null) };
    const ctrl = new NotificationsController(prisma as never, devices as never);
    return { ctrl, prisma, devices };
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

  it('rejects pause-on-every-device for staff, worker, and dealer', async () => {
    const { ctrl, prisma } = make();
    for (const user of [warehouse, worker, dealer]) {
      await expect(ctrl.putPreferences({ masterEnabled: false }, user)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
    expect(prisma.userPushSettings.upsert).not.toHaveBeenCalled();
  });

  it('stores pause-on-every-device for system administrators', async () => {
    const { ctrl, prisma } = make();
    await expect(ctrl.putPreferences({ masterEnabled: false }, admin)).resolves.toEqual({ ok: true });
    expect(prisma.userPushSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'a-1' },
        create: { userId: 'a-1', masterEnabled: false },
      }),
    );
  });

  it('rejects a worker storing a specialty topic they do not have the skill for', async () => {
    const { ctrl, prisma } = make();
    await expect(
      ctrl.putPreferences({ topics: { 'packaging.ready': true } }, worker),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userNotificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('exposes canPauseAllDevices only for system administrators', async () => {
    const { ctrl } = make();
    const staffTopics = await ctrl.listTopics(warehouse);
    const adminTopics = await ctrl.listTopics(admin);
    expect(staffTopics.canPauseAllDevices).toBe(false);
    expect(adminTopics.canPauseAllDevices).toBe(true);
    expect(staffTopics.topics.map((t) => t.code)).toContain('inventory.lowStock');
    expect(staffTopics.topics.map((t) => t.code)).not.toContain('invoice.overdue');
  });

  it('filters inbox rows to eligible topics', async () => {
    const { ctrl, prisma } = make();
    await ctrl.list(warehouse);
    const call = prisma.notification.findMany.mock.calls[0][0] as {
      where: { userId: string; OR: Array<{ topic?: string | null | { in: string[] } }> };
    };
    expect(call.where.userId).toBe('wh-1');
    const inFilter = call.where.OR.find((clause) => clause.topic && typeof clause.topic === 'object');
    expect(inFilter).toBeTruthy();
    const codes = (inFilter!.topic as { in: string[] }).in;
    expect(codes).toContain('inventory.lowStock');
    expect(codes).not.toContain('invoice.overdue');
  });
});
