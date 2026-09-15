import { RecipientResolverService } from './recipient-resolver.service';
import { getTopic } from '@maher/notifications';

describe('recipient resolver floor-operator targeting', () => {
  const topic = getTopic('task.ready')!;

  function make(users: Array<{ id: string; roles: string[]; permissions: string[]; customerId?: string | null }>) {
    const prisma = {
      userNotificationPreference: { findMany: jest.fn().mockResolvedValue([]) },
      user: {
        findMany: jest.fn().mockResolvedValue(
          users.map((u) => ({
            id: u.id,
            customerId: u.customerId ?? null,
            preferredLanguage: 'en',
            roles: u.roles.map((code) => ({
              role: {
                code,
                permissions: u.permissions.map((p) => ({ permission: { code: p } })),
              },
            })),
          })),
        ),
      },
    };
    return new RecipientResolverService(prisma as never);
  }

  it('does not fan out task.ready to unassigned floor workers', async () => {
    const svc = make([
      {
        id: 'worker-other',
        roles: ['PRODUCTION_WORKER'],
        permissions: ['production-task.read'],
      },
      {
        id: 'manager',
        roles: ['STAFF'],
        permissions: ['production-order.read', 'production-task.read'],
      },
    ]);
    const rows = await svc.resolve({ topic, recipientUserIds: [] });
    expect(rows.map((r) => r.id)).toEqual(['manager']);
  });

  it('delivers task.ready to the assigned worker', async () => {
    const svc = make([
      {
        id: 'worker-b',
        roles: ['PRODUCTION_WORKER'],
        permissions: ['production-task.read'],
      },
    ]);
    const rows = await svc.resolve({ topic, recipientUserIds: ['worker-b'] });
    expect(rows.map((r) => r.id)).toEqual(['worker-b']);
  });

  it('honours explicit preference off', async () => {
    const prisma = {
      userNotificationPreference: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'worker-b', enabled: false }]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'worker-b',
            customerId: null,
            preferredLanguage: 'ar',
            roles: [
              {
                role: {
                  code: 'PRODUCTION_WORKER',
                  permissions: [{ permission: { code: 'production-task.read' } }],
                },
              },
            ],
          },
        ]),
      },
    };
    const svc = new RecipientResolverService(prisma as never);
    const rows = await svc.resolve({ topic, recipientUserIds: ['worker-b'] });
    expect(rows).toEqual([]);
  });

  it('still delivers task.ready to the assigned worker who completed the prior stage', async () => {
    const svc = make([
      {
        id: 'worker-a',
        roles: ['PRODUCTION_WORKER'],
        permissions: ['production-task.read'],
      },
    ]);
    const rows = await svc.resolve({
      topic,
      recipientUserIds: ['worker-a'],
      actorUserId: 'worker-a',
      excludeActor: true,
    });
    expect(rows.map((r) => r.id)).toEqual(['worker-a']);
  });

  it('loads extra recipient ids without requiring isActive so deactivation can still notify', async () => {
    const topic = getTopic('user.deactivated')!;
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = new RecipientResolverService({
      userNotificationPreference: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany },
    } as never);
    await svc.resolve({ topic, recipientUserIds: ['inactive-1'] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archivedAt: null,
          OR: expect.arrayContaining([{ id: { in: ['inactive-1'] } }]),
        }),
      }),
    );
    const where = findMany.mock.calls[0][0].where as { isActive?: boolean; OR: unknown[] };
    expect(where.isActive).toBeUndefined();
  });
});
