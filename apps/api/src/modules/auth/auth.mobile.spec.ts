import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma.service';
import { encryptSecret } from '../../common/helpers/secret-box';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    phone: null,
    firstName: 'Admin',
    lastName: 'User',
    passwordHash: bcrypt.hashSync('password1', 4),
    isActive: true,
    archivedAt: null,
    lockedUntil: null,
    failedLoginAttempts: 0,
    mfaEnabled: false,
    mfaSecret: null,
    preferredLanguage: 'en',
    customerId: null,
    roles: [
      {
        role: {
          code: 'SYSTEM_ADMINISTRATOR',
          permissions: [{ permission: { code: 'user.manage' } }],
        },
      },
    ],
    ...overrides,
  };
}

describe('AuthService mobile auth', () => {
  let service: AuthService;
  let prisma: {
    user: { findFirst: jest.Mock; findFirstOrThrow: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock };
    customer: { create: jest.Mock };
    session: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    auditEvent: { create: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock };
  let sequences: { next: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn(),
      },
      customer: {
        create: jest.fn().mockResolvedValue({ id: 'cus-healed' }),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: 'sess-new' }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('access.jwt.token'),
    };
    sequences = {
      next: jest.fn().mockResolvedValue('CUST-2026-00001'),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      sequences as never,
    );
  });

  function mockLoadAuthUser() {
    const user = baseUser();
    prisma.user.findFirstOrThrow.mockResolvedValue(user);
  }

  it('loginMobile returns tokens without requiring a Response/cookies', async () => {
    const user = baseUser();
    prisma.user.findFirst.mockResolvedValue(user);
    mockLoadAuthUser();

    const result = await service.loginMobile(
      { username: 'admin', password: 'password1' },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(result.accessToken).toBe('access.jwt.token');
    expect(result.refreshToken).toHaveLength(96);
    expect(result.user.username).toBe('admin');
    expect(prisma.session.create).toHaveBeenCalled();
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'auth.login',
          userId: 'user-1',
        }),
      }),
    );
    const auditData = prisma.auditEvent.create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(JSON.stringify(auditData)).not.toContain(result.accessToken);
    expect(JSON.stringify(auditData)).not.toContain(result.refreshToken);
  });

  it('loginMobile rejects invalid credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(baseUser());
    await expect(
      service.loginMobile({ username: 'admin', password: 'wrongpass' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.login_failed' }),
      }),
    );
  });

  it('loginMobile rejects suspended accounts', async () => {
    prisma.user.findFirst.mockResolvedValue(baseUser({ isActive: false }));
    await expect(
      service.loginMobile({ username: 'admin', password: 'password1' }, {}),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }) });
  });

  it('loginMobile rejects locked accounts', async () => {
    prisma.user.findFirst.mockResolvedValue(
      baseUser({ lockedUntil: new Date(Date.now() + 60_000) }),
    );
    await expect(
      service.loginMobile({ username: 'admin', password: 'password1' }, {}),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'ACCOUNT_LOCKED' }) });
  });

  it('loginMobile requires username (not email-only)', async () => {
    await expect(
      service.loginMobile({ username: '  ', password: 'password1' }, {}),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'VALIDATION_ERROR' }) });
  });

  it('refreshMobile rotates tokens and revokes old session', async () => {
    const oldRefresh = 'a'.repeat(64);
    prisma.session.findFirst.mockResolvedValue({
      id: 'sess-old',
      userId: 'user-1',
      refreshTokenHash: hashToken(oldRefresh),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1', isActive: true });
    mockLoadAuthUser();

    const result = await service.refreshMobile(oldRefresh, { ip: '1.1.1.1' });

    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'sess-old' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.session.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('access.jwt.token');
    expect(result.refreshToken).not.toBe(oldRefresh);
    expect(result.refreshToken).toHaveLength(96);
  });

  it('refreshMobile rejects inactive users and revokes the presented session', async () => {
    const oldRefresh = 'b'.repeat(64);
    prisma.session.findFirst.mockResolvedValue({
      id: 'sess-old',
      userId: 'user-1',
      refreshTokenHash: hashToken(oldRefresh),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1', isActive: false });

    await expect(service.refreshMobile(oldRefresh, {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }),
    });

    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'sess-old' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('logoutMobile revokes session and audits without token values', async () => {
    const refresh = 'c'.repeat(64);
    prisma.session.findFirst.mockResolvedValue({ userId: 'user-1' });

    const result = await service.logoutMobile(refresh);
    expect(result).toEqual({ ok: true });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { refreshTokenHash: hashToken(refresh), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.logout', userId: 'user-1' }),
      }),
    );
    const auditData = prisma.auditEvent.create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(JSON.stringify(auditData)).not.toContain(refresh);
  });

  it('web login still sets cookies via Response', async () => {
    const user = baseUser();
    prisma.user.findFirst.mockResolvedValue(user);
    mockLoadAuthUser();
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };

    const result = await service.login(
      { username: 'admin', password: 'password1' },
      res as never,
      {},
    );

    expect(result).toEqual({ user: expect.objectContaining({ username: 'admin' }) });
    expect(res.cookie).toHaveBeenCalledWith('access_token', expect.any(String), expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', expect.any(String), expect.any(Object));
    expect(result).not.toHaveProperty('accessToken');
  });

  it('updateMe patches profile fields and returns me()', async () => {
    prisma.user.findUniqueOrThrow
      .mockResolvedValueOnce(baseUser())
      .mockResolvedValueOnce({ mfaEnabled: false, mfaSecret: null });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findFirstOrThrow.mockResolvedValue(baseUser({ firstName: 'Sam', lastName: 'Lee' }));

    const result = await service.updateMe('user-1', {
      firstName: 'Sam',
      lastName: 'Lee',
      email: 'sam@example.com',
      phone: '+96270000000',
      preferredLanguage: 'ar',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        firstName: 'Sam',
        lastName: 'Lee',
        email: 'sam@example.com',
        phone: '+96270000000',
        preferredLanguage: 'ar',
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        firstName: 'Sam',
        lastName: 'Lee',
        mfaEnabled: false,
      }),
    );
  });

  it('changePassword rejects wrong current password', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(baseUser());

    await expect(
      service.changePassword('user-1', 'wrong', 'new-pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('changePassword updates hash when current password matches', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(baseUser());

    const result = await service.changePassword('user-1', 'password1', 'new-pass');
    expect(result).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        passwordHash: expect.any(String),
        failedLoginAttempts: 0,
        lockedUntil: null,
      }),
    });
    // bcrypt.hash cost 12 is CPU-bound; keep this above Jest's 5s default under parallel workers.
  }, 15000);

  it('me returns assigned password for dealers and staff, not system administrators', async () => {
    const key = 'dev-access-secret-change-me-min-32-chars!!';
    process.env.JWT_ACCESS_SECRET = key;
    const enc = encryptSecret('123', key);

    prisma.user.findFirstOrThrow.mockResolvedValue(
      baseUser({
        id: 'dealer-1',
        username: 'nile',
        customerId: 'cus-1',
        roles: [
          {
            role: {
              code: 'CUSTOMER',
              permissions: [{ permission: { code: 'catalog.read' } }],
            },
          },
        ],
      }),
    );
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      mfaEnabled: false,
      mfaSecret: null,
      portalPasswordEnc: enc,
    });

    const dealer = await service.me('dealer-1');
    expect(dealer.portalPassword).toBe('123');
    expect(dealer.customerId).toBe('cus-1');
    expect(prisma.customer.create).not.toHaveBeenCalled();

    prisma.user.findFirstOrThrow.mockResolvedValue(
      baseUser({
        username: 'warehouse',
        roles: [
          {
            role: {
              code: 'WAREHOUSE_MANAGEMENT',
              permissions: [{ permission: { code: 'inventory.read' } }],
            },
          },
        ],
      }),
    );
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      mfaEnabled: false,
      mfaSecret: null,
      portalPasswordEnc: enc,
    });

    const staff = await service.me('user-1');
    expect(staff.portalPassword).toBe('123');
    expect(staff.roles).toEqual(['WAREHOUSE_MANAGEMENT']);
    expect(staff.rolesDetailed).toEqual([
      expect.objectContaining({
        code: 'WAREHOUSE_MANAGEMENT',
        nameEn: 'WAREHOUSE_MANAGEMENT',
      }),
    ]);

    prisma.user.findFirstOrThrow.mockResolvedValue(baseUser());
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      mfaEnabled: true,
      mfaSecret: null,
      portalPasswordEnc: enc,
    });

    const admin = await service.me('user-1');
    expect(admin).not.toHaveProperty('portalPassword');
    expect(admin.mfaEnabled).toBe(true);
  });

  it('updateMe rejects identity edits for staff accounts', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(
      baseUser({
        username: 'warehouse',
        roles: [
          {
            role: {
              code: 'WAREHOUSE_MANAGEMENT',
              permissions: [{ permission: { code: 'inventory.read' } }],
            },
          },
        ],
      }),
    );

    await expect(
      service.updateMe('user-1', { firstName: 'Sam', lastName: 'Lee' }),
    ).rejects.toMatchObject({ response: { code: 'PROFILE_LOCKED' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('me heals CUSTOMER users missing a linked dealer customerId', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue(
      baseUser({
        id: 'orphan-1',
        username: 'nile',
        firstName: 'Nile',
        lastName: 'Nile',
        customerId: null,
        roles: [
          {
            role: {
              code: 'CUSTOMER',
              kind: 'CUSTOMER',
              permissions: [{ permission: { code: 'request.create' } }],
            },
          },
        ],
      }),
    );
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      mfaEnabled: false,
      mfaSecret: null,
      portalPasswordEnc: null,
    });

    const me = await service.me('orphan-1');
    expect(sequences.next).toHaveBeenCalled();
    expect(prisma.customer.create).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'orphan-1' },
      data: { customerId: 'cus-healed' },
    });
    expect(me.customerId).toBe('cus-healed');
  });

  it('changePassword rejects staff accounts', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(
      baseUser({
        username: 'warehouse',
        roles: [
          {
            role: {
              code: 'WAREHOUSE_MANAGEMENT',
              permissions: [{ permission: { code: 'inventory.read' } }],
            },
          },
        ],
      }),
    );

    await expect(service.changePassword('user-1', 'password1', 'new-pass')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
