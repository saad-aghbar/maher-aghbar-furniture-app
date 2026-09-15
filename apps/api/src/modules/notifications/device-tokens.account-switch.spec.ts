import { DeviceTokensService } from './device-tokens.service';
import { isDevicePushDeliverable } from '@maher/notifications';

type TokenRow = {
  id: string;
  userId: string;
  token: string;
  platform: string;
  deviceId: string | null;
  pushEnabled: boolean;
  osPermission: string | null;
  lastSeenAt: Date;
  failedCount: number;
  disabledAt: Date | null;
};

function createMemoryPrisma(rows: TokenRow[]) {
  return {
    devicePushToken: {
      findUnique: async ({ where }: { where: { token: string } }) =>
        rows.find((r) => r.token === where.token) ?? null,
      create: async ({ data }: { data: TokenRow }) => {
        if (rows.some((r) => r.token === data.token)) {
          const err = Object.assign(new Error('unique'), { code: 'P2002' });
          throw err;
        }
        rows.push({ ...data });
        return data;
      },
      update: async ({ where, data }: { where: { token: string }; data: Partial<TokenRow> }) => {
        const row = rows.find((r) => r.token === where.token);
        if (!row) throw new Error('missing');
        Object.assign(row, data);
        return row;
      },
      deleteMany: async ({ where }: { where: { token: string; userId: string } }) => {
        const next = rows.filter((r) => !(r.token === where.token && r.userId === where.userId));
        const count = rows.length - next.length;
        rows.splice(0, rows.length, ...next);
        return { count };
      },
      findMany: async ({ where }: { where: { userId: string; pushEnabled: boolean; disabledAt: null } }) =>
        rows.filter(
          (r) => r.userId === where.userId && r.pushEnabled === where.pushEnabled && r.disabledAt == null,
        ),
      updateMany: async ({
        where,
        data,
      }: {
        where: { userId?: string; disabledAt?: null; token?: string };
        data: Partial<TokenRow>;
      }) => {
        let count = 0;
        for (const row of rows) {
          if (where.token && row.token !== where.token) continue;
          if (where.userId && row.userId !== where.userId) continue;
          if (where.disabledAt === null && row.disabledAt != null) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
  };
}

describe('device token account switch', () => {
  it('A logout then B login on the same phone leaves A undeliverable', async () => {
    const rows: TokenRow[] = [];
    const prisma = createMemoryPrisma(rows);
    const devices = new DeviceTokensService(prisma as never);
    const token = 'ExponentPushToken[shared-phone]';

    await devices.register({
      userId: 'A',
      token,
      platform: 'ios',
      osPermission: 'granted',
      pushEnabled: true,
    });
    expect(rows[0]?.userId).toBe('A');

    await devices.release('A', token);
    expect(rows).toHaveLength(0);

    await devices.register({
      userId: 'B',
      token,
      platform: 'ios',
      osPermission: 'granted',
      pushEnabled: true,
    });
    expect(rows[0]?.userId).toBe('B');

    const aTokens = await devices.listDeliverable('A');
    const bTokens = await devices.listDeliverable('B');
    expect(aTokens).toHaveLength(0);
    expect(bTokens).toHaveLength(1);
    expect(
      isDevicePushDeliverable({
        userId: bTokens[0]!.userId,
        intendedUserId: 'A',
        pushEnabled: true,
        osPermission: 'granted',
        disabledAt: null,
        userMasterEnabled: true,
      }),
    ).toBe(false);
  });

  it('B login steals a token still bound to A (offline logout)', async () => {
    const rows: TokenRow[] = [];
    const prisma = createMemoryPrisma(rows);
    const devices = new DeviceTokensService(prisma as never);
    const token = 'ExponentPushToken[shared-phone]';

    await devices.register({ userId: 'A', token, platform: 'android', osPermission: 'granted' });
    await devices.register({ userId: 'B', token, platform: 'android', osPermission: 'granted' });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe('B');

    const delayedLogout = await devices.release('A', token);
    expect(delayedLogout.released).toBe(false);
    expect(rows[0]?.userId).toBe('B');
  });

  it('disableAllForUser stops further push to that account', async () => {
    const rows: TokenRow[] = [];
    const prisma = createMemoryPrisma(rows);
    const devices = new DeviceTokensService(prisma as never);
    await devices.register({
      userId: 'A',
      token: 'ExponentPushToken[a]',
      platform: 'ios',
      osPermission: 'granted',
    });
    await devices.disableAllForUser('A');
    expect(rows[0]?.disabledAt).toBeInstanceOf(Date);
    expect(await devices.listDeliverable('A')).toHaveLength(0);
  });
});
