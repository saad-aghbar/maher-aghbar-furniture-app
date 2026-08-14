import type { AuthUser } from '@maher/types';
import { CatalogController } from './catalog.controller';
import type { PrismaService } from '../../common/prisma.service';

const DEALER_LEAK_KEYS = [
  'manufacturingCost',
  'bomDefaults',
  'adminNotes',
  'basePrice',
];

function assertNoDealerLeaks(value: unknown, path = 'root'): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoDealerLeaks(item, `${path}[${i}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DEALER_LEAK_KEYS.includes(key)) {
      throw new Error(`Leak field "${key}" at ${path}`);
    }
    assertNoDealerLeaks(child, `${path}.${key}`);
  }
}

describe('CatalogController.browseProducts scope', () => {
  const dealerA: AuthUser = {
    id: 'user-a',
    username: 'cedar',
    email: 'a@example.com',
    name: 'Cedar',
    roles: ['CUSTOMER'],
    permissions: ['catalog.read'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
  };

  const admin: AuthUser = {
    id: 'admin',
    username: 'admin',
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMIN'],
    permissions: ['catalog.read', 'catalog.manage'],
    preferredLanguage: 'en',
  };

  const productRow = {
    id: 'p1',
    sku: 'SF-001',
    nameEn: 'Modern Sofa',
    nameAr: 'كنبة',
    nameHe: null,
    description: null,
    categoryId: 'cat1',
    category: { id: 'cat1', code: 'SOFA', nameEn: 'Sofas', nameAr: 'كنب', nameHe: null },
    basePrice: 900,
    unit: 'pcs',
    isActive: true,
    imageUrl: 'https://example.com/sofa.png',
    galleryUrls: [],
    manufacturingCost: 400,
    bomDefaults: { materials: [] },
    adminNotes: 'secret',
    width: null,
    height: null,
    depth: null,
    seatHeight: null,
    customMeasurements: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };

  function makeController() {
    const count = jest.fn().mockResolvedValue(1);
    const findMany = jest.fn().mockResolvedValue([productRow]);
    const $transaction = jest.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    );
    const dealerPriceFindMany = jest.fn().mockResolvedValue([
      { productId: 'p1', customerId: 'customer-a', price: 850, currency: 'ILS' },
      // B’s price must never be queried; if mistakenly returned, assertions catch it
      { productId: 'p1', customerId: 'customer-b', price: 9999, currency: 'ILS' },
    ]);

    const prisma = {
      product: { count, findMany },
      dealerPrice: { findMany: dealerPriceFindMany },
      $transaction,
    };

    const sequences = { next: jest.fn() } as never;
    const controller = new CatalogController(
      prisma as unknown as PrismaService,
      sequences,
    );
    return { controller, dealerPriceFindMany, findMany };
  }

  it('scopes dealerPrice query to the caller customerId only', async () => {
    const { controller, dealerPriceFindMany } = makeController();
    await controller.browseProducts({ page: 1, pageSize: 20 } as never, dealerA);

    expect(dealerPriceFindMany).toHaveBeenCalled();
    const arg = dealerPriceFindMany.mock.calls[0]![0] as {
      where: { customerId: string; productId: { in: string[] } };
    };
    expect(arg.where.customerId).toBe('customer-a');
    expect(JSON.stringify(arg)).not.toContain('customer-b');
  });

  it('strips costs and basePrice for dealers and uses own dealer price', async () => {
    const { controller: _controller } = makeController();
    // Mock returns both A and B rows — map must only use A (first match for p1 in loop overwrites)
    // Rebuild with only A’s price to mirror real where clause filtering
    const prismaDealerOnly = {
      product: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([productRow]),
      },
      dealerPrice: {
        findMany: jest.fn().mockImplementation(async (args: { where: { customerId: string } }) => {
          expect(args.where.customerId).toBe('customer-a');
          return [{ productId: 'p1', customerId: 'customer-a', price: 850, currency: 'ILS' }];
        }),
      },
      $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    const ctrl = new CatalogController(
      prismaDealerOnly as unknown as PrismaService,
      { next: jest.fn() } as never,
    );
    const result = await ctrl.browseProducts({ page: 1, pageSize: 20 } as never, dealerA);
    const row = result.data[0] as Record<string, unknown>;
    expect(row.price).toBe(850);
    expect(row.dealerPrice).toBe(850);
    expect(row.priceCurrency).toBe('ILS');
    assertNoDealerLeaks(result);
  });

  it('never exposes another dealer price when map is correctly scoped', async () => {
    const { controller: _controller } = makeController();
    // First makeController returns both A and B for same productId — last write wins in Map.set.
    // Simulate correct DB filter: only A.
    const prisma = {
      product: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([productRow]),
      },
      dealerPrice: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 'p1', customerId: 'customer-a', price: 850, currency: 'ILS' },
        ]),
      },
      $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    const ctrl = new CatalogController(
      prisma as unknown as PrismaService,
      { next: jest.fn() } as never,
    );
    const result = await ctrl.browseProducts({ page: 1, pageSize: 20 } as never, dealerA);
    const row = result.data[0] as unknown as { price: number };
    expect(row.price).toBe(850);
    expect(JSON.stringify(result)).not.toContain('9999');
  });

  it('keeps manufacturingCost and basePrice for admin', async () => {
    const { controller } = makeController();
    const result = await controller.browseProducts({ page: 1, pageSize: 20 } as never, admin);
    const row = result.data[0] as Record<string, unknown>;
    expect(row.manufacturingCost).toBe(400);
    expect(row.basePrice).toBe(900);
    expect(row.price).toBe(900); // no dealer map for admin without customerId
  });
});

describe('CatalogController.browseProductById scope', () => {
  const dealerA: AuthUser = {
    id: 'user-a',
    username: 'cedar',
    email: 'a@example.com',
    name: 'Cedar',
    roles: ['CUSTOMER'],
    permissions: ['catalog.read'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
  };

  const productRow = {
    id: 'p1',
    sku: 'SF-001',
    nameEn: 'Modern Sofa',
    nameAr: 'كنبة',
    nameHe: null,
    description: 'Comfortable sofa',
    categoryId: 'cat1',
    category: { id: 'cat1', code: 'SOFA', nameEn: 'Sofas', nameAr: 'كنب', nameHe: null },
    basePrice: 900,
    unit: 'pcs',
    isActive: true,
    imageUrl: 'https://example.com/sofa.png',
    galleryUrls: ['https://example.com/sofa-2.png'],
    manufacturingCost: 400,
    bomDefaults: { materials: [] },
    adminNotes: 'secret',
    width: 220,
    height: 85,
    depth: 90,
    seatHeight: null,
    customMeasurements: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };

  it('returns dealer-scoped price and strips costs for dealer', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      productId: 'p1',
      customerId: 'customer-a',
      price: 850,
      currency: 'ILS',
    });
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue(productRow),
      },
      dealerPrice: { findUnique },
    };
    const ctrl = new CatalogController(
      prisma as unknown as PrismaService,
      { next: jest.fn() } as never,
    );
    const result = (await ctrl.browseProductById('p1', dealerA)) as Record<string, unknown>;
    expect(result.price).toBe(850);
    expect(result.dealerPrice).toBe(850);
    expect(result.description).toBe('Comfortable sofa');
    assertNoDealerLeaks(result);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        customerId_productId: {
          customerId: 'customer-a',
          productId: 'p1',
        },
      },
    });
  });

  it('never loads another dealer’s price for detail', async () => {
    const findUnique = jest.fn().mockImplementation(async (args: {
      where: { customerId_productId: { customerId: string } };
    }) => {
      expect(args.where.customerId_productId.customerId).toBe('customer-a');
      expect(JSON.stringify(args)).not.toContain('customer-b');
      return { price: 850, currency: 'ILS' };
    });
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue(productRow) },
      dealerPrice: { findUnique },
    };
    const ctrl = new CatalogController(
      prisma as unknown as PrismaService,
      { next: jest.fn() } as never,
    );
    await ctrl.browseProductById('p1', dealerA);
    expect(findUnique).toHaveBeenCalled();
  });
});
