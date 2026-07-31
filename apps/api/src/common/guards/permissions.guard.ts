import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type Permission } from '@maher/permissions';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/auth.decorators';
import type { AuthUser } from '@maher/types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAll = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredAll?.length && !requiredAny?.length) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Permission denied.' });

    if (requiredAll?.length && !hasPermission(user.permissions, requiredAll)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Missing permission: ${requiredAll.join(', ')}`,
      });
    }

    if (requiredAny?.length && !requiredAny.some((p) => user.permissions.includes(p))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Missing one of: ${requiredAny.join(', ')}`,
      });
    }

    return true;
  }
}
