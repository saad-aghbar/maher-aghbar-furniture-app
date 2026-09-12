import 'reflect-metadata';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@maher/types';
import { CatalogController } from './catalog.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { PrismaService } from '../../common/prisma.service';

const admin: AuthUser = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@example.com',
  name: 'Admin',
  roles: ['SYSTEM_ADMIN'],
  permissions: ['catalog.manage', 'catalog.read'],
  preferredLanguage: 'en',
};

const dealer: AuthUser = {
  id: 'dealer-1',
  username: 'nile',
  email: 'nile@example.com',
  name: 'Nile',
  roles: ['CUSTOMER'],
  permissions: ['request.create', 'catalog.read'],
  preferredLanguage: 'ar',
  customerId: 'cust-1',
};

function makeCtx(handler: (...args: never[]) => unknown, user: AuthUser) {
  return {
    getHandler: () => handler,
    getClass: () => CatalogController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('CatalogController spec option libraries', () => {
  const group = {
    id: 'g-foam',
    code: 'FOAM_DENSITY',
    nameEn: 'Foam density',
    nameAr: 'كثافة الإسفنج',
    isActive: true,
    sortOrder: 10,
  };
  const activeValue = {
    id: 'v-35',
    groupId: 'g-foam',
    code: 'D35',
    nameEn: 'Foam 35',
    nameAr: 'إسفنج 35',
    isActive: true,
    sortOrder: 20,
    inventoryItemId: 'inv-foam-md',
  };
  const inactiveValue = {
    id: 'v-old',
    groupId: 'g-foam',
    code: 'D28',
    nameEn: 'Foam 28',
    nameAr: 'إسفنج 28',
    isActive: false,
    sortOrder: 5,
  };

  function makeController() {
    const values = [activeValue, inactiveValue];
    const prisma = {
      specOptionGroup: {
        findUnique: jest.fn(async ({ where: { id, code } }: { where: { id?: string; code?: string } }) => {
          if (code === group.code || id === group.id) return group;
          return null;
        }),
        count: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      specOptionValue: {
        findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
          values.find((v) => v.id === id) ?? null,
        ),
        findFirst: jest.fn(async ({ where }: { where: { groupId: string; code: string } }) =>
          values.find((v) => v.groupId === where.groupId && v.code === where.code) ?? null,
        ),
        count: jest.fn(async ({ where }: { where: { isActive?: boolean } }) =>
          values.filter((v) => (where.isActive == null ? true : v.isActive === where.isActive)).length,
        ),
        findMany: jest.fn(async ({ where }: { where: { isActive?: boolean } }) =>
          values.filter((v) => (where.isActive == null ? true : v.isActive === where.isActive)),
        ),
        create: jest.fn(async ({ data }: { data: typeof activeValue }) => ({ ...data, id: 'v-new' })),
        update: jest.fn(async ({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = values.find((v) => v.id === id);
          if (!row) return null;
          Object.assign(row, data);
          return row;
        }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    const controller = new CatalogController(
      prisma as unknown as PrismaService,
      { next: jest.fn() } as never,
      { ensureDefaultVariant: jest.fn(), syncDefaultVariantFromProduct: jest.fn() } as never,
      { createProductFromOrderLine: jest.fn() } as never,
    );
    return { controller, prisma };
  }

  it('hides deactivated values from new pickers but GET-by-id still returns them', async () => {
    const { controller } = makeController();
    const listed = await controller.listSpecOptionValues({ page: 1, pageSize: 20 } as never);
    expect(listed.data).toEqual([activeValue]);
    expect(listed.data.find((v) => (v as { id: string }).id === 'v-old')).toBeUndefined();

    const historical = await controller.getSpecOptionValue('v-old');
    expect(historical).toMatchObject({ id: 'v-old', isActive: false });
  });

  it('includeInactive=true returns historical values for admin CRUD', async () => {
    const { controller } = makeController();
    const listed = await controller.listSpecOptionValues({
      page: 1,
      pageSize: 20,
      includeInactive: 'true',
    } as never);
    expect(listed.data).toHaveLength(2);
  });

  it('creates a value and rejects duplicate codes in the same group', async () => {
    const { controller } = makeController();
    await expect(
      controller.createSpecOptionValue(
        {
          groupId: 'g-foam',
          code: 'D35',
          nameEn: 'Dup',
          nameAr: 'مكرر',
        } as never,
        admin,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const created = await controller.createSpecOptionValue(
      {
        groupId: 'g-foam',
        code: 'D42',
        nameEn: 'Foam 42',
        nameAr: 'إسفنج 42',
      } as never,
      admin,
    );
    expect(created).toMatchObject({ code: 'D42', isActive: true });
  });

  it('deactivating a value keeps GET readable', async () => {
    const { controller } = makeController();
    const row = await controller.deactivateSpecOptionValue('v-35', admin);
    expect(row).toMatchObject({ id: 'v-35', isActive: false });
    const stillThere = await controller.getSpecOptionValue('v-35');
    expect(stillThere).toMatchObject({ id: 'v-35', isActive: false });
  });

  it('returns NOT_FOUND for a missing value', async () => {
    const { controller } = makeController();
    await expect(controller.getSpecOptionValue('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not expose inventory cost on option GET', async () => {
    const { controller, prisma } = makeController();
    prisma.specOptionValue.findUnique.mockResolvedValueOnce({
      ...activeValue,
      group,
      colorReference: null,
      inventoryItem: { id: 'inv-foam-md', sku: 'MAT-FOAM-MD' },
    });
    const row = await controller.getSpecOptionValue('v-35');
    expect(JSON.stringify(row)).not.toContain('standardCost');
    expect(JSON.stringify(row)).not.toContain('manufacturingCost');
  });

  it('denies mutations without catalog.manage', () => {
    const guard = new PermissionsGuard(new Reflector());
    expect(() =>
      guard.canActivate(makeCtx(CatalogController.prototype.createSpecOptionGroup, dealer)),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(makeCtx(CatalogController.prototype.createSpecOptionValue, dealer)),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(makeCtx(CatalogController.prototype.listSpecOptionValues, dealer)),
    ).toBe(true);
  });
});
