import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { PrismaService } from '../prisma.service';
import type { AuthUser } from '@maher/types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string; cookie?: string };
      cookies?: { access_token?: string };
      user?: AuthUser;
    }>();

    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = bearer ?? req.cookies?.access_token;
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required.' });

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-min-32-chars!!',
      });
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, archivedAt: null, isActive: true },
        include: {
          roles: {
            include: {
              role: {
                include: { permissions: { include: { permission: true } } },
              },
            },
          },
        },
      });
      if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'User not found.' });

      const roles = user.roles.map((r) => r.role.code);
      const permissions = [
        ...new Set(
          user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)),
        ),
      ];

      req.user = {
        id: user.id,
        email: user.email ?? '',
        phone: user.phone ?? undefined,
        name: `${user.firstName} ${user.lastName}`.trim(),
        roles,
        permissions,
        preferredLanguage: user.preferredLanguage,
        customerId: user.customerId ?? undefined,
      } as AuthUser & { customerId?: string };

      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid or expired token.' });
    }
  }
}
