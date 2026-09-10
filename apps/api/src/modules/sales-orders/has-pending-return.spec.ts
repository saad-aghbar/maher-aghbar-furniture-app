import { isPendingReturnLifecycle } from '../production/production-origin';
import type { AuthUser } from '@maher/types';
import { SalesOrdersService } from './sales-orders.service';
import type { PrismaService } from '../../common/prisma.service';

describe('hasPendingReturn on sales-order list', () => {
  const admin: AuthUser = {
    id: 'admin',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['sales-order.read', 'report.financial.read'],
    preferredLanguage: 'en',
  };

  const dealer: AuthUser = {
    ...admin,
    id: 'dealer',
    customerId: 'cust-1',
    roles: ['CUSTOMER'],
    permissions: ['sales-order.read'],
  };

  const row = {
    id: 'so1',
    number: 'ORD-1',
    status: 'DELIVERED',
    priority: 'NORMAL',
    customerId: 'cust-1',
    total: 1000,
    requiredDeliveryDate: new Date('2026-08-20'),
    customer: { id: 'cust-1', name: 'Cedar', nameAr: null, nameEn: 'Cedar', nameHe: null, code: 'C1' },
    quotation: null,
    lines: [
      {
        id: 'l1',
        description: 'Sofa',
        quantity: 1,
        unitPrice: 1000,
        lineTotal: 1000,
        productId: 'p1',
        manufacturingComplexity: 'STANDARD',
        product: {
          id: 'p1',
          sku: 'S1',
          nameAr: null,
          nameEn: 'Sofa',
          nameHe: null,
          imageUrl: null,
          manufacturingCost: 400,
          basePrice: 900,
          bomDefaults: null,
        },
      },
    ],
    productionOrders: [],
    productionSetup: null,
    deliveries: [],
    returns: [
      { id: 'ret-old', number: 'RET-OLD', lifecycleState: 'COMPLETED', reason: 'OTHER' },
      { id: 'ret-open', number: 'RET-OPEN', lifecycleState: 'REQUESTED', reason: 'MANUFACTURING_DEFECT' },
    ],
    _count: { returns: 2 },
  };

  function makeService() {
    const prisma = {
      salesOrder: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([row]),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      dealerPrice: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      productionStageDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      auditEvent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new SalesOrdersService(
      prisma as unknown as PrismaService,
      {} as never,
      {
        sendFromTemplate: jest.fn(),
        notifyAdminUsers: jest.fn(),
        notifyCustomerUsers: jest.fn(),
      } as never,
      { createAccessToken: jest.fn(() => 'tok') } as never,
      { generateForProductionOrder: jest.fn() } as never,
      { createSnapshotForProductionOrder: jest.fn() } as never,
      { tryReserveForSalesOrder: jest.fn(), releaseForSalesOrder: jest.fn() } as never,
      { onProductionOrdersCancelled: jest.fn() } as never,
      { ensureSetup: jest.fn(), isReleased: jest.fn().mockResolvedValue(false) } as never,
      { summaryForSalesOrder: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
    );
    jest.spyOn(service, 'hydrateLineProducts').mockImplementation(async (lines) => lines as never);
    jest.spyOn(service, 'loadDealerPrices').mockResolvedValue(new Map());
    jest.spyOn(service, 'loadMaterialCosts').mockResolvedValue(new Map());
    jest.spyOn(service, 'costsForLines').mockReturnValue({
      sellerPrice: 1000,
      productionPrice: 400,
      manufacturingCost: 400,
      profit: 600,
      costBreakdown: {},
    } as never);
    return { service, prisma };
  }

  it('keeps hasReturn true for any linked return and flags only pending ones', async () => {
    const { service } = makeService();
    const result = await service.list({ page: 1, pageSize: 20 } as never, admin);
    const out = result.data[0] as {
      hasReturn?: boolean;
      hasPendingReturn?: boolean;
      returnSummary?: { number: string; lifecycleState: string };
    };
    expect(out.hasReturn).toBe(true);
    expect(out.hasPendingReturn).toBe(true);
    expect(out.returnSummary).toMatchObject({ number: 'RET-OPEN', lifecycleState: 'REQUESTED' });
  });

  it('silently ignores orderType and returned for dealers', async () => {
    const { service, prisma } = makeService();
    const result = await service.list(
      { page: 1, pageSize: 20, orderType: 'STANDARD', returned: true } as never,
      dealer,
    );
    expect(result.meta).not.toHaveProperty('orderTypeCounts');
    expect(result.meta).not.toHaveProperty('returned');
    expect(prisma.salesOrder.findMany.mock.calls[0][0].where).not.toHaveProperty('id');
  });

  it('treats COMPLETED, restock, and scrap as not pending', () => {
    expect(isPendingReturnLifecycle('COMPLETED')).toBe(false);
    expect(isPendingReturnLifecycle('RETURNED_TO_STOCK')).toBe(false);
    expect(isPendingReturnLifecycle('SCRAPPED')).toBe(false);
    expect(isPendingReturnLifecycle('REQUESTED')).toBe(true);
  });
});
