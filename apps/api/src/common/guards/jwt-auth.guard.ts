import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { effectivePermissionCodes } from '../helpers/auth-permissions.util';
import { resolveJwtAccessSecret } from '../helpers/jwt-secret';
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
        secret: resolveJwtAccessSecret(),
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
          workerSkills: {
            where: { isActive: true },
            include: { stageDefinition: { select: { code: true } } },
          },
        },
      });
      if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'User not found.' });

      const roles = user.roles.map((r) => r.role.code);
      const permissions = effectivePermissionCodes(
        roles,
        user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)),
      );
      const stageSkillCodes = (user.workerSkills ?? [])
        .map((s) => s.stageDefinition.code)
        .filter(Boolean);

      req.user = {
        id: user.id,
        username: user.username ?? '',
        email: user.email ?? '',
        phone: user.phone ?? undefined,
        name: `${user.firstName} ${user.lastName}`.trim(),
        roles,
        permissions,
        stageSkillCodes,
        preferredLanguage: user.preferredLanguage,
        customerId: user.customerId ?? undefined,
      } as AuthUser & { customerId?: string };

      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid or expired token.' });
    }
  }
}
