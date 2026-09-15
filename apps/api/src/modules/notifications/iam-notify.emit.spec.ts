import { notificationEventId } from '@maher/notifications';
import { IamNotifyService } from './iam-notify.service';

describe('IamNotifyService', () => {
  function make() {
    const emit = jest.fn().mockResolvedValue({ ok: true, count: 1 });
    const svc = new IamNotifyService({ emit } as never);
    return { svc, emit };
  }

  it('emits user.invited without secrets after create', async () => {
    const { svc, emit } = make();
    await svc.onInvited({ userId: 'u-new', actorUserId: 'admin-1' });
    expect(emit).toHaveBeenCalledTimes(1);
    const payload = emit.mock.calls[0][0];
    expect(payload.topic).toBe('user.invited');
    expect(payload.eventId).toBe(
      notificationEventId({
        topic: 'user.invited',
        entityType: 'user',
        entityId: 'u-new',
        transition: 'CREATED',
      }),
    );
    expect(payload.recipientUserIds).toEqual(['u-new']);
    expect(payload.excludeActor).toBe(true);
    expect(payload.actorUserId).toBe('admin-1');
    expect(payload.vars).toEqual({});
    expect(JSON.stringify(payload)).not.toMatch(/password|PIN|secret|token|temporary/i);
  });

  it('emits user.deactivated with a stable retry eventId', async () => {
    const { svc, emit } = make();
    await svc.onDeactivated({
      userId: 'u-1',
      actorUserId: 'admin-1',
      transition: 'DEACTIVATED:2026-09-14T15:00:00.000Z',
    });
    await svc.onDeactivated({
      userId: 'u-1',
      actorUserId: 'admin-1',
      transition: 'DEACTIVATED:2026-09-14T15:00:00.000Z',
    });
    expect(emit.mock.calls[0][0].eventId).toBe(emit.mock.calls[1][0].eventId);
    expect(emit.mock.calls[0][0].topic).toBe('user.deactivated');
    expect(JSON.stringify(emit.mock.calls[0][0])).not.toMatch(/reason|note|password/i);
  });

  it('emits user.roleChanged with from→to fingerprint (not a permission matrix)', async () => {
    const { svc, emit } = make();
    await svc.onRoleChanged({
      userId: 'u-wh',
      actorUserId: 'admin-1',
      fromCodes: ['WAREHOUSE_MANAGEMENT'],
      toCodes: ['FINANCE'],
    });
    const payload = emit.mock.calls[0][0];
    expect(payload.topic).toBe('user.roleChanged');
    expect(payload.eventId).toBe(
      notificationEventId({
        topic: 'user.roleChanged',
        entityType: 'user',
        entityId: 'u-wh',
        transition: 'ROLE:WAREHOUSE_MANAGEMENT->FINANCE',
      }),
    );
    expect(payload.vars).toEqual({});
    expect(JSON.stringify(payload)).not.toMatch(/inventory\.read|invoice\.read|permission/i);
  });
});
