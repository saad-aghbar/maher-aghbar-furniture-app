import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleKind } from '@maher/database';
import {
  expandPermissionDependencies,
  generateStaffTypeCode,
  groupedPermissionCatalog,
  isAssignableToStaff,
  PERMISSIONS,
  type Permission,
} from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { actorHoldsPermission } from '../../common/helpers/auth-permissions.util';

const IDENTITY_PROTECTED = new Set(['SYSTEM_ADMINISTRATOR', 'CUSTOMER', 'PRODUCTION_WORKER']);

export type StaffTypeWrite = {
  nameEn: string;
  nameAr: string;
  nameHe?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  descriptionHe?: string;
  iconKey?: string | null;
  isActive?: boolean;
  permissionCodes?: string[];
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  permissionCatalog(assignableToStaffOnly = false) {
    return groupedPermissionCatalog({ assignableToStaffOnly });
  }

  listRoles(query?: { kind?: RoleKind; isActive?: boolean }) {
    return this.prisma.role.findMany({
      where: {
        ...(query?.kind ? { kind: query.kind } : {}),
        ...(query?.isActive === undefined ? {} : { isActive: query.isActive }),
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { nameEn: 'asc' }],
    });
  }

  async getRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found.' });
    return role;
  }

  async createGenericRole(
    actor: AuthUser,
    input: {
      code: string;
      nameAr: string;
      nameEn: string;
      nameHe?: string;
      description?: string;
      permissionCodes?: string[];
    },
  ) {
    const code = input.code.toUpperCase().replace(/\s+/g, '_');
    const clash = await this.prisma.role.findUnique({ where: { code } });
    if (clash) {
      throw new ConflictException({ code: 'ROLE_EXISTS', message: 'Role code already exists.' });
    }
    const permissionCodes = this.preparePermissionCodes(actor, input.permissionCodes ?? [], 'STAFF');
    const role = await this.prisma.role.create({
      data: {
        code,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        nameHe: input.nameHe,
        description: input.description,
        kind: 'STAFF',
        isSystem: false,
        isActive: true,
      },
    });
    await this.setPermissions(role.id, permissionCodes);
    await this.audit(actor.id, 'role.create', role.id, { code, permissionCodes });
    return this.getRole(role.id);
  }

  async createStaffType(actor: AuthUser, input: StaffTypeWrite) {
    const existing = await this.prisma.role.findMany({ select: { code: true } });
    const code = generateStaffTypeCode(
      input.nameEn,
      existing.map((r) => r.code),
    );
    const permissionCodes = this.preparePermissionCodes(actor, input.permissionCodes ?? [], 'STAFF');
    const role = await this.prisma.role.create({
      data: {
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        nameHe: input.nameHe?.trim() || null,
        descriptionEn: input.descriptionEn?.trim() || null,
        descriptionAr: input.descriptionAr?.trim() || null,
        descriptionHe: input.descriptionHe?.trim() || null,
        description: input.descriptionEn?.trim() || null,
        iconKey: input.iconKey ?? null,
        kind: 'STAFF',
        isSystem: false,
        isActive: input.isActive ?? true,
      },
    });
    await this.setPermissions(role.id, permissionCodes);
    await this.audit(actor.id, 'staff_type.create', role.id, { code, permissionCodes });
    return this.getRole(role.id);
  }

  async updateStaffType(actor: AuthUser, id: string, input: StaffTypeWrite) {
    const existing = await this.requireStaffType(id);
    const previousCodes = existing.permissions.map((rp) => rp.permission.code);
    const permissionCodes =
      input.permissionCodes === undefined
        ? undefined
        : this.preparePermissionCodes(actor, input.permissionCodes, 'STAFF');

    await this.prisma.role.update({
      where: { id },
      data: {
        nameEn: input.nameEn?.trim() ?? existing.nameEn,
        nameAr: input.nameAr?.trim() ?? existing.nameAr,
        nameHe: input.nameHe === undefined ? existing.nameHe : input.nameHe.trim() || null,
        descriptionEn:
          input.descriptionEn === undefined
            ? existing.descriptionEn
            : input.descriptionEn.trim() || null,
        descriptionAr:
          input.descriptionAr === undefined
            ? existing.descriptionAr
            : input.descriptionAr.trim() || null,
        descriptionHe:
          input.descriptionHe === undefined
            ? existing.descriptionHe
            : input.descriptionHe.trim() || null,
        iconKey: input.iconKey === undefined ? existing.iconKey : input.iconKey,
        isActive: input.isActive ?? existing.isActive,
      },
    });

    if (permissionCodes) {
      await this.setPermissions(id, permissionCodes);
      const previous = new Set<string>(previousCodes);
      const next = new Set<string>(permissionCodes);
      const added = permissionCodes.filter((c) => !previous.has(c));
      const removed = previousCodes.filter((c) => !next.has(c));
      await this.audit(actor.id, 'staff_type.permissions', id, { added, removed });
    }

    await this.audit(actor.id, 'staff_type.update', id, {
      nameEn: input.nameEn,
      isActive: input.isActive,
    });
    return this.getRole(id);
  }

  async duplicateStaffType(actor: AuthUser, id: string) {
    const src = await this.requireStaffType(id);
    const existing = await this.prisma.role.findMany({ select: { code: true } });
    const code = generateStaffTypeCode(`${src.nameEn} copy`, existing.map((r) => r.code));
    const permissionCodes = this.preparePermissionCodes(
      actor,
      src.permissions.map((rp) => rp.permission.code),
      'STAFF',
    );
    const role = await this.prisma.role.create({
      data: {
        code,
        nameEn: `${src.nameEn} (copy)`,
        nameAr: `${src.nameAr} (نسخة)`,
        nameHe: src.nameHe ? `${src.nameHe} (עותק)` : null,
        descriptionEn: src.descriptionEn,
        descriptionAr: src.descriptionAr,
        descriptionHe: src.descriptionHe,
        description: src.description,
        iconKey: src.iconKey,
        kind: 'STAFF',
        isSystem: false,
        isActive: true,
      },
    });
    await this.setPermissions(role.id, permissionCodes);
    await this.audit(actor.id, 'staff_type.duplicate', role.id, { from: id, code });
    return this.getRole(role.id);
  }

  async deactivateStaffType(actor: AuthUser, id: string) {
    const role = await this.requireStaffType(id);
    if (role.isSystem) {
      throw new BadRequestException({
        code: 'PROTECTED_ROLE',
        message: 'System-critical roles cannot be deleted.',
      });
    }
    await this.prisma.role.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit(actor.id, 'staff_type.deactivate', id, { code: role.code });
    return this.getRole(id);
  }

  async removeStaffType(actor: AuthUser, id: string) {
    await this.requireStaffType(id);
    return this.removeRole(actor, id);
  }

  async updateGenericRole(
    actor: AuthUser,
    id: string,
    input: {
      nameAr?: string;
      nameEn?: string;
      nameHe?: string;
      description?: string;
      permissionCodes?: string[];
    },
  ) {
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found.' });
    const permissionCodes =
      input.permissionCodes === undefined
        ? undefined
        : this.preparePermissionCodes(actor, input.permissionCodes, existing.kind);
    const previousCodes = existing.permissions.map((rp) => rp.permission.code);
    await this.prisma.role.update({
      where: { id },
      data: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        nameHe: input.nameHe,
        description: input.description,
      },
    });
    if (permissionCodes) {
      await this.setPermissions(id, permissionCodes);
      const previous = new Set<string>(previousCodes);
      const next = new Set<string>(permissionCodes);
      await this.audit(actor.id, 'role.permissions', id, {
        added: permissionCodes.filter((c) => !previous.has(c)),
        removed: previousCodes.filter((c) => !next.has(c)),
      });
    }
    await this.audit(actor.id, 'role.update', id, input);
    return this.getRole(id);
  }

  async duplicateGenericRole(actor: AuthUser, id: string) {
    const src = await this.getRole(id);
    return this.duplicateStaffType(actor, src.id);
  }

  async removeRole(actor: AuthUser, id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found.' });
    if (IDENTITY_PROTECTED.has(role.code) || role.isSystem) {
      throw new BadRequestException({
        code: 'PROTECTED_ROLE',
        message: 'System-critical roles cannot be deleted.',
      });
    }
    if (role._count.users > 0) {
      throw new ConflictException({
        code: 'ROLE_IN_USE',
        message: 'This role cannot be deleted because users are assigned to it.',
      });
    }
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.role.delete({ where: { id } });
    await this.audit(actor.id, 'role.delete', id, { code: role.code });
    return { ok: true };
  }

  private async requireStaffType(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found.' });
    if (role.kind !== 'STAFF') {
      throw new BadRequestException({
        code: 'INVALID_ROLE',
        message: 'This role is not a staff type.',
      });
    }
    return role;
  }

  preparePermissionCodes(actor: AuthUser, codes: string[], kind: RoleKind): Permission[] {
    if (codes.includes('*')) {
      throw new BadRequestException({
        code: 'INVALID_PERMISSIONS',
        message: 'Wildcard permissions are not allowed.',
      });
    }
    const known = new Set<string>(PERMISSIONS);
    const invalid = codes.filter((code) => !known.has(code));
    if (invalid.length) {
      throw new BadRequestException({
        code: 'INVALID_PERMISSIONS',
        message: 'One or more permission codes are invalid.',
      });
    }
    const expanded = expandPermissionDependencies(codes);
    const missing = expanded.filter((c) => !actorHoldsPermission(actor, c));
    if (missing.length) {
      throw new BadRequestException({
        code: 'CANNOT_GRANT',
        message: `You cannot grant permissions you do not hold: ${missing.join(', ')}`,
      });
    }
    if (kind === 'STAFF') {
      const forbidden = expanded.filter((c) => !isAssignableToStaff(c as (typeof PERMISSIONS)[number]));
      if (forbidden.length) {
        throw new BadRequestException({
          code: 'STAFF_FORBIDDEN_PERMISSION',
          message: `These permissions cannot be assigned to staff: ${forbidden.join(', ')}`,
        });
      }
    }
    return expanded;
  }

  private async setPermissions(roleId: string, codes: string[]) {
    const perms = await this.prisma.permission.findMany({ where: { code: { in: codes } } });
    if (perms.length !== codes.length) {
      throw new BadRequestException({
        code: 'INVALID_PERMISSIONS',
        message: 'One or more permission codes are invalid.',
      });
    }
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (perms.length) {
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
      });
    }
  }

  private audit(userId: string, action: string, entityId: string, newValues: unknown) {
    return this.prisma.auditEvent.create({
      data: {
        userId,
        action,
        entityType: 'Role',
        entityId,
        newValues: (newValues ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
