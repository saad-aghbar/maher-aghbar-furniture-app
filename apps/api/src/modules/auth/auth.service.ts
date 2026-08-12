import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Locale } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { LoginDto, MobileLoginDto, UpdateMeDto } from './dto/auth.dto';
import type { AuthUser } from '@maher/types';
import type { Response } from 'express';
import {
  buildOtpauthUrl,
  generateTotpSecret,
  verifyTotp,
} from '../../common/helpers/totp.util';
import { decryptPortalPassword } from '../../common/helpers/secret-box';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async loadAuthUser(userId: string): Promise<AuthUser & { customerId?: string }> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, isActive: true, archivedAt: null },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    const roles = user.roles.map((r) => r.role.code);
    const permissions = [
      ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code))),
    ];
    return {
      id: user.id,
      username: user.username ?? '',
      email: user.email ?? '',
      phone: user.phone ?? undefined,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      roles,
      permissions,
      preferredLanguage: user.preferredLanguage,
      customerId: user.customerId ?? undefined,
    };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const secure = process.env.COOKIE_SECURE === 'true';
    const common = {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/',
    };
    res.cookie('access_token', accessToken, { ...common, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...common, maxAge: 30 * 24 * 60 * 60 * 1000 });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  async login(dto: LoginDto, res: Response, meta: { ip?: string; userAgent?: string }) {
    const { authUser, tokens } = await this.authenticateWithPassword(dto, meta);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    if (dto.client === 'mobile') {
      return {
        user: authUser,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }

    return { user: authUser };
  }

  /**
   * Cookie-free mobile login. Returns access + rotating refresh in the body.
   * Never logs token values.
   */
  async loginMobile(dto: MobileLoginDto, meta: { ip?: string; userAgent?: string }) {
    const { authUser, tokens } = await this.authenticateWithPassword(dto, meta);
    return {
      user: authUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private async authenticateWithPassword(
    dto: { username: string; password: string; mfaCode?: string },
    meta: { ip?: string; userAgent?: string },
  ) {
    const username = (dto.username ?? '').trim().toLowerCase();
    if (!username) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Username required.' });
    }

    const user = await this.prisma.user.findFirst({
      where: {
        archivedAt: null,
        username,
      },
    });

    if (!user) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({ code: 'ACCOUNT_LOCKED', message: 'Account temporarily locked.' });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({ code: 'ACCOUNT_SUSPENDED', message: 'Account suspended.' });
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      const attempts = user.failedLoginAttempts + 1;
      const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lockedUntil },
      });
      await this.prisma.auditEvent.create({
        data: {
          userId: user.id,
          action: 'auth.login_failed',
          entityType: 'User',
          entityId: user.id,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        },
      });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' });
    }

    if (user.mfaEnabled && user.mfaSecret) {
      if (!dto.mfaCode?.trim()) {
        throw new UnauthorizedException({
          code: 'MFA_REQUIRED',
          message: 'Multi-factor authentication code required.',
        });
      }
      if (!verifyTotp(user.mfaSecret, dto.mfaCode.trim())) {
        throw new UnauthorizedException({
          code: 'MFA_INVALID',
          message: 'Invalid multi-factor authentication code.',
        });
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const authUser = await this.loadAuthUser(user.id);
    const tokens = await this.issueTokens(user.id, meta);

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'auth.login',
        entityType: 'User',
        entityId: user.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return { authUser, tokens };
  }

  private async issueTokens(userId: string, meta: { ip?: string; userAgent?: string }) {
    const accessSecret = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-min-32-chars!!';
    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: 'access' },
      { secret: accessSecret, expiresIn: '15m' },
    );
    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  async refresh(
    refreshToken: string | undefined,
    res: Response,
    meta: { ip?: string; userAgent?: string },
    client?: 'web' | 'mobile',
  ) {
    const result = await this.rotateRefreshToken(refreshToken, meta, { requireActiveUser: false });
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    if (client === 'mobile') {
      return {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    }
    return { user: result.user };
  }

  /**
   * Cookie-free mobile refresh with rotating opaque token.
   * Rejects disabled/archived users before issuing a new session.
   */
  async refreshMobile(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const result = await this.rotateRefreshToken(refreshToken, meta, { requireActiveUser: true });
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  private async rotateRefreshToken(
    refreshToken: string | undefined,
    meta: { ip?: string; userAgent?: string },
    options: { requireActiveUser: boolean },
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Refresh token required.' });
    }
    const hash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!session) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token.' });
    }

    if (options.requireActiveUser) {
      const account = await this.prisma.user.findFirst({
        where: { id: session.userId, archivedAt: null },
        select: { id: true, isActive: true },
      });
      if (!account || !account.isActive) {
        await this.prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException({
          code: 'ACCOUNT_SUSPENDED',
          message: 'Account suspended.',
        });
      }
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(session.userId, meta);
    const user = await this.loadAuthUser(session.userId);
    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(refreshToken: string | undefined, userId: string | undefined, res: Response) {
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      await this.prisma.session.updateMany({
        where: { refreshTokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (userId) {
      await this.prisma.auditEvent.create({
        data: {
          userId,
          action: 'auth.logout',
          entityType: 'User',
          entityId: userId,
        },
      });
    }
    this.clearAuthCookies(res);
    return { ok: true };
  }

  /**
   * Cookie-free mobile logout — revokes the refresh session by hash.
   * Optional userId (from Bearer) for audit only; tokens are never logged.
   */
  async logoutMobile(refreshToken: string, userId?: string) {
    const hash = this.hashToken(refreshToken);
    const updated = await this.prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    let auditUserId = userId;
    if (!auditUserId && updated.count > 0) {
      const session = await this.prisma.session.findFirst({
        where: { refreshTokenHash: hash },
        select: { userId: true },
      });
      auditUserId = session?.userId;
    }

    if (auditUserId) {
      await this.prisma.auditEvent.create({
        data: {
          userId: auditUserId,
          action: 'auth.logout',
          entityType: 'User',
          entityId: auditUserId,
        },
      });
    }

    return { ok: true };
  }

  async logoutAll(userId: string, res: Response) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.clearAuthCookies(res);
    return { ok: true };
  }

  async me(userId: string) {
    const authUser = await this.loadAuthUser(userId);
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true, portalPasswordEnc: true },
    });
    return {
      ...authUser,
      mfaEnabled: row.mfaEnabled,
      mfaPending: Boolean(row.mfaSecret && !row.mfaEnabled),
      ...(authUser.customerId
        ? { portalPassword: decryptPortalPassword(row.portalPasswordEnc) }
        : {}),
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    if (
      dto.firstName === undefined &&
      dto.lastName === undefined &&
      dto.email === undefined &&
      dto.phone === undefined &&
      dto.preferredLanguage === undefined
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No profile fields to update.',
      });
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (!email) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Email is required.',
        });
      }
      const taken = await this.prisma.user.findFirst({
        where: {
          email,
          archivedAt: null,
          NOT: { id: userId },
        },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'Email is already in use.',
        });
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.preferredLanguage !== undefined
          ? { preferredLanguage: dto.preferredLanguage as Locale }
          : {}),
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'auth.profile_updated',
        entityType: 'User',
        entityId: userId,
        newValues: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
          ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
          ...(dto.preferredLanguage !== undefined
            ? { preferredLanguage: dto.preferredLanguage }
            : {}),
        },
      },
    });

    return this.me(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 1) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password is required.',
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, customerId: true },
    });
    if (user.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Dealer portal passwords are managed by the admin.',
      });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Current password is incorrect.',
      });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'auth.password_changed',
        entityType: 'User',
        entityId: userId,
      },
    });
    return { ok: true };
  }

  /** In-memory reset tokens for local/dev; production should use Redis. */
  private static resetTokens = new Map<string, { userId: string; exp: number }>();

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), archivedAt: null },
    });
    // Always return ok to avoid email enumeration
    if (!user) return { ok: true, message: 'If the account exists, a reset code was issued.' };
    // Dealer portal passwords are admin-managed — do not issue reset tokens.
    if (user.customerId) {
      return { ok: true, message: 'If the account exists, a reset code was issued.' };
    }

    const token = randomBytes(24).toString('hex');
    AuthService.resetTokens.set(token, {
      userId: user.id,
      exp: Date.now() + 30 * 60 * 1000,
    });

    // Console email provider
    // eslint-disable-next-line no-console
    console.log(`[email:console] password reset for ${email}: token=${token}`);

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'auth.password_reset_requested',
        entityType: 'User',
        entityId: user.id,
      },
    });

    return {
      ok: true,
      message: 'If the account exists, a reset code was issued.',
      ...(process.env.NODE_ENV !== 'production' ? { devToken: token } : {}),
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const entry = AuthService.resetTokens.get(token);
    if (!entry || entry.exp < Date.now()) {
      throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'Reset token invalid or expired.' });
    }
    if (!newPassword || newPassword.length < 1) {
      throw new BadRequestException({ code: 'WEAK_PASSWORD', message: 'Password is required.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    AuthService.resetTokens.delete(token);
    await this.prisma.session.updateMany({
      where: { userId: entry.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: entry.userId,
        action: 'auth.password_reset',
        entityType: 'User',
        entityId: entry.userId,
      },
    });
    return { ok: true };
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async invite(
    dto: {
      username: string;
      email?: string;
      firstName: string;
      lastName: string;
      roleCode: string;
      phone?: string;
    },
    actorId: string,
  ) {
    const username = dto.username.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new BadRequestException({ code: 'USER_EXISTS', message: 'User already exists.' });
    }
    const role = await this.prisma.role.findUnique({ where: { code: dto.roleCode } });
    if (!role) throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Role not found.' });

    const tempPassword = randomBytes(9).toString('base64url') + 'Aa1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const user = await this.prisma.user.create({
      data: {
        username,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        isActive: true,
        isEmailVerified: false,
        roles: { create: { roleId: role.id } },
      },
    });

    // eslint-disable-next-line no-console
    console.log(`[email:console] invite ${username} tempPassword=${tempPassword}`);

    await this.prisma.auditEvent.create({
      data: {
        userId: actorId,
        action: 'user.invite',
        entityType: 'User',
        entityId: user.id,
        newValues: { username, roleCode: dto.roleCode },
      },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...(process.env.NODE_ENV !== 'production' ? { tempPassword } : {}),
    };
  }

  async enableMfa(userId: string) {
    const secret = generateTotpSecret();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.prisma.user.update({
      where: { id: userId },
      // Secret stored; MFA not enforced until confirmMfa succeeds.
      data: { mfaSecret: secret, mfaEnabled: false },
    });
    const account = user.username || user.email || userId;
    return {
      mfaEnabled: false,
      pending: true,
      secret,
      otpauthUrl: buildOtpauthUrl({ secret, accountName: account }),
    };
  }

  async confirmMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) {
      throw new BadRequestException({
        code: 'MFA_NOT_SETUP',
        message: 'Call mfa/enable first to receive a secret.',
      });
    }
    if (!verifyTotp(user.mfaSecret, code)) {
      throw new BadRequestException({ code: 'MFA_INVALID', message: 'Invalid MFA code.' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'auth.mfa_enabled',
        entityType: 'User',
        entityId: userId,
      },
    });
    return { mfaEnabled: true };
  }

  async disableMfa(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { mfaEnabled: false };
  }
}
