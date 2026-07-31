import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { LoginDto } from './dto/auth.dto';
import type { AuthUser } from '@maher/types';
import type { Response } from 'express';

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
      email: user.email ?? '',
      phone: user.phone ?? undefined,
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
    if (!dto.email && !dto.phone) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Email or phone required.' });
    }

    const user = await this.prisma.user.findFirst({
      where: {
        archivedAt: null,
        OR: [
          dto.email ? { email: dto.email.toLowerCase() } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as Array<{ email?: string; phone?: string }>,
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const authUser = await this.loadAuthUser(user.id);
    const tokens = await this.issueTokens(user.id, meta);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

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

    return { user: authUser };
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

  async refresh(refreshToken: string | undefined, res: Response, meta: { ip?: string; userAgent?: string }) {
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

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(session.userId, meta);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    const user = await this.loadAuthUser(session.userId);
    return { user };
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

  async logoutAll(userId: string, res: Response) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.clearAuthCookies(res);
    return { ok: true };
  }

  async me(userId: string) {
    return this.loadAuthUser(userId);
  }

  /** In-memory reset tokens for local/dev; production should use Redis. */
  private static resetTokens = new Map<string, { userId: string; exp: number }>();

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), archivedAt: null },
    });
    // Always return ok to avoid email enumeration
    if (!user) return { ok: true, message: 'If the account exists, a reset code was issued.' };

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
    if (newPassword.length < 8) {
      throw new BadRequestException({ code: 'WEAK_PASSWORD', message: 'Password too short.' });
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

  async invite(dto: {
    email: string;
    firstName: string;
    lastName: string;
    roleCode: string;
    phone?: string;
  }, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new BadRequestException({ code: 'USER_EXISTS', message: 'User already exists.' });
    }
    const role = await this.prisma.role.findUnique({ where: { code: dto.roleCode } });
    if (!role) throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Role not found.' });

    const tempPassword = randomBytes(9).toString('base64url') + 'Aa1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
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
    console.log(`[email:console] invite ${dto.email} tempPassword=${tempPassword}`);

    await this.prisma.auditEvent.create({
      data: {
        userId: actorId,
        action: 'user.invite',
        entityType: 'User',
        entityId: user.id,
        newValues: { email: dto.email, roleCode: dto.roleCode },
      },
    });

    return {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      ...(process.env.NODE_ENV !== 'production' ? { tempPassword } : {}),
    };
  }

  async enableMfa(userId: string) {
    const secret = randomBytes(20).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaSecret: secret },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'auth.mfa_enabled',
        entityType: 'User',
        entityId: userId,
      },
    });
    return {
      mfaEnabled: true,
      // TOTP secret for authenticator apps (setup QR left to client)
      secret,
      otpauthUrl: `otpauth://totp/MaherERP:${userId}?secret=${secret}&issuer=MaherERP`,
    };
  }

  async disableMfa(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { mfaEnabled: false };
  }
}
