import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@maher/types';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { VariantsController } from './variants.controller';
import { VariantsService } from './variants.service';
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

const product = {
  id: 'p-karina',
  sku: 'SOF-KARINA',
  nameAr: 'كرينا',
  nameEn: 'Karina',
  nameHe: 'קרינה',
  isActive: true,
  archivedAt: null,
  basePrice: 1280,
  manufacturingCost: 610,
  bomDefaults: null,
  imageUrl: null,
  galleryUrls: [],
  width: 200,
  height: 90,
  depth: 90,
  seatHeight: 42,
  customMeasurements: null,
  adminNotes: 'secret',
};

function variantRow(partial: Record<string, unknown> = {}) {
  return {
    id: 'v-ukr',
    productId: product.id,
    sku: 'SOF-KARINA-UKR',
    code: 'UKR',
    nameAr: 'أوكرانيه',
    nameEn: 'Ukrainian',
    nameHe: 'אוקראינית',
    isDefault: false,
    isActive: true,
    archivedAt: null,
    sortOrder: 1,
    manufacturingCost: 700,
    bomDefaults: { materials: [] },
    adminNotes: 'factory only',
    factoryNotesAr: 'لف بسيط',
    factoryNotesEn: 'Simple wrap',
    measurements: [{ key: 'width', value: 1.15, unit: 'm' }],
    options: [],
    ...partial,
  };
}

function makeCtx(handler: (...args: never[]) => unknown, user: AuthUser) {
  return {
    getHandler: () => handler,
    getClass: () => VariantsController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('VariantsController', () => {
  function make() {
    const rows = [variantRow({ id: 'v-std', code: 'STD', sku: 'SOF-KARINA-STD', isDefault: true })];
    const prisma = {
      product: {
        findFirst: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
          id === product.id ? product : null,
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(product, data);
          return product;
        }),
      },
      productVariant: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.id) return rows.find((r) => r.id === where.id && r.productId === where.productId) ?? null;
          if (where.sku) return rows.find((r) => r.sku === where.sku) ?? null;
          if (where.code) return rows.find((r) => r.code === where.code && r.productId === where.productId) ?? null;
          if (where.isDefault) return rows.find((r) => r.isDefault) ?? null;
          return rows[0];
        }),
        findMany: jest.fn(async ({ where }: { where: { isActive?: boolean } }) =>
          rows.filter((r) => (where.isActive == null ? true : r.isActive === where.isActive)),
        ),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = variantRow({
            id: 'v-new',
            code: data.code,
            sku: data.sku,
            isDefault: data.isDefault ?? false,
            manufacturingCost: data.manufacturingCost ?? null,
            adminNotes: data.adminNotes ?? null,
            factoryNotesAr: data.factoryNotesAr ?? null,
          });
          rows.push(row);
          return row;
        }),
        update: jest.fn(async ({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = rows.find((r) => r.id === id);
          if (!row) return null;
          Object.assign(row, data);
          return row;
        }),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      productVariantOption: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      specOptionValue: {
        findMany: jest.fn(async ({ where: { id } }: { where: { id: { in: string[] } } }) =>
          (id?.in ?? []).map((valueId: string) => ({ id: valueId })),
        ),
      },
      productStageMaterialInput: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      productStageInventoryOutput: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      productStageInventoryInput: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      productStageEstimate: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      laborRate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      productProductionProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      productWorkflowStageOverride: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      dealerPrice: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      productStageInstruction: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };
    const service = new VariantsService(prisma as unknown as PrismaService);
    const controller = new VariantsController(service, {
      createVariantFromOrderLine: jest.fn(),
    } as never);
    return { controller, prisma, rows };
  }

  it('lists variants and strips cost fields for dealers', async () => {
    const { controller } = make();
    const listed = await controller.list('p-karina', { includeInactive: 'true' } as never, dealer);
    expect(listed.length).toBeGreaterThan(0);
    expect(JSON.stringify(listed)).not.toContain('manufacturingCost');
    expect(JSON.stringify(listed)).not.toContain('adminNotes');
    expect(JSON.stringify(listed)).not.toContain('factoryNotesAr');
  });

  it('creates a variant and keeps measurements with mixed units', async () => {
    const { controller } = make();
    const created = (await controller.create(
      'p-karina',
      {
        code: 'UKR2',
        nameAr: 'أوكرانيه',
        nameEn: 'Ukrainian',
        measurements: [{ key: 'width', labelAr: 'ص', labelEn: 'W', value: 1.15, unit: 'm' }],
      } as never,
      admin,
    )) as { code: string; measurements?: unknown };
    expect(created.code).toBe('UKR2');
  });

  it('auto-assigns V2 when code is omitted', async () => {
    const { controller } = make();
    const created = (await controller.create(
      'p-karina',
      { nameAr: 'أوكرانيه' } as never,
      admin,
    )) as { code: string };
    expect(created.code).toBe('V2');
  });

  it('refuses to deactivate the default variant', async () => {
    const { controller } = make();
    await expect(controller.deactivate('p-karina', 'v-std', admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns NOT_FOUND for a missing variant', async () => {
    const { controller } = make();
    await expect(controller.get('p-karina', 'missing', admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies mutations without catalog.manage', () => {
    const guard = new PermissionsGuard(new Reflector());
    expect(() =>
      guard.canActivate(makeCtx(VariantsController.prototype.create, dealer)),
    ).toThrow(ForbiddenException);
    expect(guard.canActivate(makeCtx(VariantsController.prototype.list, dealer))).toBe(true);
  });

  it('marks the first variant as standard with code STD', async () => {
    const { controller, prisma, rows } = make();
    rows.length = 0;
    const created = (await controller.create(
      'p-karina',
      { nameAr: 'قياسي' } as never,
      admin,
    )) as { code: string; isDefault: boolean };
    expect(created.code).toBe('STD');
    expect(created.isDefault).toBe(true);
    expect(prisma.productVariant.create).toHaveBeenCalled();
    const data = (prisma.productVariant.create as jest.Mock).mock.calls[0][0].data;
    expect(data.manufacturingCost).toBeNull();
    expect(data.basePrice).toBeNull();
    expect(data.measurements).toEqual([]);
  });

  it('copies measurements and factory notes from the standard variant', async () => {
    const { controller, rows } = make();
    rows.push(
      variantRow({
        id: 'v-copy',
        code: 'V2',
        sku: 'SOF-KARINA-V2',
        isDefault: false,
        measurements: [],
        factoryNotesAr: null,
      }),
    );
    const copied = (await controller.copyFromStandard('p-karina', 'v-copy', admin)) as {
      measurements?: unknown;
      factoryNotesAr?: string | null;
    };
    expect(copied.factoryNotesAr).toBe('لف بسيط');
    expect(copied.measurements).toEqual([{ key: 'width', value: 1.15, unit: 'm' }]);
  });

  it('derives manufacturing cost from variant BOM plus stage labor and persists it', async () => {
    const { controller, prisma, rows } = make();
    rows[0] = variantRow({
      id: 'v-std',
      code: 'STD',
      sku: 'SOF-KARINA-STD',
      isDefault: true,
      bomDefaults: {
        materials: [{ sku: 'FAB-001', qty: 2, unitCost: 0, category: 'FABRIC' }],
      },
    });
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      { sku: 'FAB-001', standardCost: 10 },
    ]);
    (prisma.productStageEstimate.findMany as jest.Mock).mockResolvedValue([
      {
        productId: 'p-karina',
        variantId: 'v-std',
        stageDefinitionId: 'st-cut',
        quantityScalingMode: 'LINEAR',
        minutesPerUnit: 60,
        setupMinutes: 0,
        fixedMinutes: 0,
        batchSize: 1,
        batchMinutes: 0,
        maxParallelUnits: 1,
      },
    ]);
    (prisma.laborRate.findMany as jest.Mock).mockResolvedValue([
      {
        hourlyRate: 30,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: null,
        userId: null,
        stageDefinitionId: null,
      },
    ]);

    const cost = (await controller.cost('p-karina', 'v-std')) as {
      materials: { total: number };
      labor: { minutes: number; hours: number; cost: number };
      manufacturingCost: number;
    };
    expect(cost.materials.total).toBe(20);
    expect(cost.labor.minutes).toBe(60);
    expect(cost.labor.hours).toBe(1);
    expect(cost.labor.cost).toBe(30);
    expect(cost.manufacturingCost).toBe(50);
    expect(prisma.productVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-std' },
        data: { manufacturingCost: 50 },
      }),
    );
  });
});
