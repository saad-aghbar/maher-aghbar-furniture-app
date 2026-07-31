import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@maher/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return request.user;
  },
);
