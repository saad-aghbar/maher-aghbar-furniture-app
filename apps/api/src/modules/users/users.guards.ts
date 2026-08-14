import { ForbiddenException, BadRequestException } from '@nestjs/common';

/** Pure guards used by UsersController — unit-tested without Prisma. */
export function assertCannotDeactivateSelf(actorId: string, targetId: string) {
  if (actorId === targetId) {
    throw new ForbiddenException({
      code: 'CANNOT_DEACTIVATE_SELF',
      message: 'You cannot deactivate your own account.',
    });
  }
}

export function assertCannotDeleteSelf(actorId: string, targetId: string) {
  if (actorId === targetId) {
    throw new ForbiddenException({
      code: 'CANNOT_DELETE_SELF',
      message: 'You cannot delete your own account.',
    });
  }
}

export function assertCannotRemoveOwnAdmin(
  actorId: string,
  targetId: string,
  wasAdmin: boolean,
  stillAdmin: boolean,
) {
  if (actorId === targetId && wasAdmin && !stillAdmin) {
    throw new ForbiddenException({
      code: 'CANNOT_REMOVE_OWN_ADMIN',
      message: 'You cannot remove your own system administrator role.',
    });
  }
}

export function assertNotLastActiveAdmin(otherActiveAdminCount: number) {
  if (otherActiveAdminCount === 0) {
    throw new BadRequestException({
      code: 'LAST_ADMIN',
      message: 'There must be at least one active system administrator.',
    });
  }
}
