import { BadRequestException } from '@nestjs/common';
import { ROLE_PERMISSIONS } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { RolesService } from './roles.service';
import type { PrismaService } from '../../common/prisma.service';

function actor(permissions: string[], roles: string[] = ['SYSTEM_ADMINISTRATOR']): AuthUser {
  return {
    id: 'admin-1',
    username: 'admin',
    email: 'a@b.c',
    name: 'Admin',
    roles,
    permissions,
    preferredLanguage: 'en',
  };
}

describe('RolesService.preparePermissionCodes', () => {
  const service = new RolesService({} as PrismaService);

  it('rejects unknown permission codes', () => {
    expect(() =>
      service.preparePermissionCodes(actor(['inventory.read']), ['can.do.anything'], 'STAFF'),
    ).toThrow(BadRequestException);
  });

  it('rejects wildcard grants', () => {
    expect(() => service.preparePermissionCodes(actor(['*']), ['*'], 'STAFF')).toThrow(
      /INVALID_PERMISSIONS|Wildcard/,
    );
  });

  it('rejects privilege escalation', () => {
    try {
      service.preparePermissionCodes(
        actor(['inventory.read'], ['WAREHOUSE_MANAGEMENT']),
        ['role.manage'],
        'STAFF',
      );
      fail('expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = (e as BadRequestException).getResponse() as { code?: string };
      expect(['CANNOT_GRANT', 'STAFF_FORBIDDEN_PERMISSION']).toContain(body.code);
    }
  });

  it('rejects staff-forbidden permissions even when the actor holds them', () => {
    try {
      service.preparePermissionCodes(
        actor([...ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR]),
        ['role.manage'],
        'STAFF',
      );
      fail('expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({
        code: 'STAFF_FORBIDDEN_PERMISSION',
      });
    }
  });

  it('lets a system administrator grant expanded staff permissions they lack in the session list', () => {
    const codes = service.preparePermissionCodes(
      actor(['role.manage']),
      ['inventory.transfer'],
      'STAFF',
    );
    expect(codes).toEqual(
      expect.arrayContaining(['inventory.read', 'warehouse.read', 'inventory.transfer']),
    );
  });

  it('expands transfer with read dependencies', () => {
    const codes = service.preparePermissionCodes(
      actor(['inventory.read', 'inventory.transfer', 'warehouse.read'], ['WAREHOUSE_MANAGEMENT']),
      ['inventory.transfer'],
      'STAFF',
    );
    expect(codes).toEqual(
      expect.arrayContaining(['inventory.read', 'warehouse.read', 'inventory.transfer']),
    );
  });
});

describe('RolesService.removeStaffType', () => {
  function prismaFor(role: Record<string, unknown> | null, users = 0) {
    return {
      role: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(role)
          .mockResolvedValueOnce(role ? { ...role, _count: { users } } : null),
        delete: jest.fn().mockResolvedValue({}),
      },
      rolePermission: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
  }

  it('deletes a custom staff type with no assigned users', async () => {
    const prisma = prismaFor({
      id: 'st-1',
      code: 'CUSTOM_BUYER',
      kind: 'STAFF',
      isSystem: false,
      permissions: [],
    });
    const service = new RolesService(prisma);
    await expect(service.removeStaffType(actor(['role.manage']), 'st-1')).resolves.toEqual({ ok: true });
    expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 'st-1' } });
  });

  it('blocks deleting a system preset', async () => {
    const prisma = prismaFor({
      id: 'st-sys',
      code: 'WAREHOUSE_MANAGEMENT',
      kind: 'STAFF',
      isSystem: true,
      permissions: [],
    });
    const service = new RolesService(prisma);
    await expect(service.removeStaffType(actor(['role.manage']), 'st-sys')).rejects.toMatchObject({
      response: { code: 'PROTECTED_ROLE' },
    });
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('blocks deleting a staff type that still has users', async () => {
    const prisma = prismaFor(
      {
        id: 'st-used',
        code: 'CUSTOM_BUYER',
        kind: 'STAFF',
        isSystem: false,
        permissions: [],
      },
      2,
    );
    const service = new RolesService(prisma);
    await expect(service.removeStaffType(actor(['role.manage']), 'st-used')).rejects.toMatchObject({
      response: { code: 'ROLE_IN_USE' },
    });
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('rejects identity roles that are not staff types', async () => {
    const prisma = prismaFor({
      id: 'role-1',
      code: 'SYSTEM_ADMINISTRATOR',
      kind: 'IDENTITY',
      isSystem: true,
      permissions: [],
    });
    const service = new RolesService(prisma);
    await expect(service.removeStaffType(actor(['role.manage']), 'role-1')).rejects.toMatchObject({
      response: { code: 'INVALID_ROLE' },
    });
  });
});
