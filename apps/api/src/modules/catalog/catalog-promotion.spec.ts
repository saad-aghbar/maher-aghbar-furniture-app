import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@maher/types';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CatalogController } from './catalog.controller';
import { CatalogPromotionService } from './catalog-promotion.service';

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

describe('CatalogPromotionService', () => {
  const line = {
    id: 'line-1',
    description: 'Custom Karina 250',
    unitPrice: 1200,
    variantLabel: 'Ukrainian',
    variantSku: 'KAR-250',
    productId: null,
    orderSpec: {
      productName: 'Karina',
      width: 250,
      foamDensity: 'D35',
      variantLabel: 'Ukrainian',
      orientation: 'LEFT',
      includedItems: [{ nameAr: 'قرن', qty: 4 }],
    },
    productionSetup: {
      materialRequirements: [{ sku: 'FOAM-D35', expectedQty: 2, sortOrder: 0 }],
    },
  };

  function makeService() {
    const created = { id: 'prod-new', sku: 'PRD-1', nameEn: 'Karina', nameAr: 'Karina' };
    const prisma = {
      salesOrderLine: {
        findFirst: jest.fn().mockResolvedValue(line),
        update: jest.fn(),
      },
      product: {
        create: jest.fn().mockResolvedValue(created),
        findFirst: jest.fn().mockResolvedValue({ ...created, variants: [] }),
      },
      specOptionValue: {
        findMany: jest.fn().mockResolvedValue([{ id: 'opt-d35' }]),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const sequences = { next: jest.fn().mockResolvedValue('PRD-1') };
    const variants = {
      ensureDefaultVariant: jest.fn().mockResolvedValue({ id: 'var-std' }),
      create: jest.fn().mockResolvedValue({ id: 'var-ukr', width: 250, orientation: 'LEFT' }),
    };
    const service = new CatalogPromotionService(prisma as never, sequences as never, variants as never);
    return { service, prisma, variants };
  }

  it('creates a catalog product from orderSpec and setup materials without mutating the line', async () => {
    const { service, prisma, variants } = makeService();
    const row = await service.createProductFromOrderLine('line-1', 'admin-1');
    expect(prisma.product.create).toHaveBeenCalled();
    expect(prisma.salesOrderLine.update).not.toHaveBeenCalled();
    expect(variants.create).toHaveBeenCalledWith(
      'prod-new',
      expect.objectContaining({
        width: 250,
        options: [{ specOptionValueId: 'opt-d35' }],
        bomDefaults: { materials: [{ sku: 'FOAM-D35', qty: 2 }] },
      }),
      'admin-1',
    );
    expect(row?.id).toBe('prod-new');
  });

  it('promotes a variant onto an existing product with the same dims and materials', async () => {
    const { service, prisma, variants } = makeService();
    prisma.product.findFirst.mockResolvedValue({ id: 'p-karina', archivedAt: null });
    const row = await service.createVariantFromOrderLine('p-karina', 'line-1', 'admin-1');
    expect(prisma.salesOrderLine.update).not.toHaveBeenCalled();
    expect(variants.create).toHaveBeenCalledWith(
      'p-karina',
      expect.objectContaining({
        width: 250,
        measurements: expect.arrayContaining([
          expect.objectContaining({ key: 'width', value: 250 }),
        ]),
      }),
      'admin-1',
    );
    expect(row.id).toBe('var-ukr');
  });

  it('denies dealers from promoting via catalog.manage', () => {
    const guard = new PermissionsGuard(new Reflector());
    expect(() =>
      guard.canActivate(makeCtx(CatalogController.prototype.createProductFromOrderLine, dealer)),
    ).toThrow(ForbiddenException);
  });
});
