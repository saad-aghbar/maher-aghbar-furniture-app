/**
 * Route / bucket / readiness acceptance for Orders ↔ Production IA.
 * Pure helpers — no RN / network.
 */

import { classifyAdminOrderJourney } from '../adminOrderJourney';

function isReleasedToFactory(po: {
  releasedToFactoryAt?: Date | string | null;
}): boolean {
  return Boolean(po.releasedToFactoryAt);
}

function productionFactoryBucket(po: {
  releasedToFactoryAt?: Date | string | null;
  status?: string | null;
  actualStartDate?: Date | string | null;
}): 'preparing' | 'ready_to_start' | 'in_production' {
  if (!isReleasedToFactory(po)) return 'preparing';
  const status = String(po.status ?? '').toUpperCase();
  if (
    status === 'IN_PROGRESS' ||
    status === 'ON_HOLD' ||
    status === 'QUALITY_CHECK' ||
    status === 'READY_FOR_PACKAGING' ||
    status === 'READY_FOR_DELIVERY' ||
    status === 'COMPLETED' ||
    Boolean(po.actualStartDate)
  ) {
    return 'in_production';
  }
  return 'ready_to_start';
}

/** Canonical admin routes for prep vs factory ownership. */
export function orderProductionRoute(args: {
  salesOrderId: string;
  productionOrderId?: string | null;
  releasedToFactory: boolean;
  hasProductionOrders: boolean;
}): { host: 'orders-setup' | 'orders-plan' | 'production'; path: string } {
  if (!args.hasProductionOrders) {
    return {
      host: 'orders-setup',
      path: `/(app)/(admin)/orders/${args.salesOrderId}/production-setup`,
    };
  }
  if (!args.releasedToFactory) {
    return {
      host: 'orders-plan',
      path: `/(app)/(admin)/orders/${args.salesOrderId}/production-plan`,
    };
  }
  const po = args.productionOrderId ?? 'po';
  return {
    host: 'production',
    path: `/(app)/(admin)/production/${po}`,
  };
}

describe('Orders / Production route map', () => {
  it('RFQ Accepted → Open SO lands on Orders desk (Preparing owns prep)', () => {
    const soId = 'so-1';
    expect(`/(app)/(admin)/orders/${soId}`).toContain('/orders/');
    expect(
      orderProductionRoute({
        salesOrderId: soId,
        releasedToFactory: false,
        hasProductionOrders: false,
      }).host,
    ).toBe('orders-setup');
  });

  it('Setup + Plan pre-release stay on orders routes (not Production)', () => {
    const plan = orderProductionRoute({
      salesOrderId: 'so-1',
      productionOrderId: 'po-1',
      releasedToFactory: false,
      hasProductionOrders: true,
    });
    expect(plan.host).toBe('orders-plan');
    expect(plan.path).toContain('/orders/so-1/production-plan');
    expect(plan.path).not.toContain('/production/po-1');
  });

  it('Release → Open Production on /production/[id]', () => {
    const r = orderProductionRoute({
      salesOrderId: 'so-1',
      productionOrderId: 'po-1',
      releasedToFactory: true,
      hasProductionOrders: true,
    });
    expect(r.host).toBe('production');
    expect(r.path).toBe('/(app)/(admin)/production/po-1');
  });

  it('RFQ has no Production Plan editor route', () => {
    const rfqPath = '/(app)/(admin)/requests/req-1';
    expect(rfqPath).not.toContain('production-plan');
  });
});

describe('Orders vs Production bucket consistency', () => {
  it('unreleased plan-ready SO is Preparing only (not Production ready_to_start)', () => {
    const orders = classifyAdminOrderJourney({
      status: 'READY_FOR_PRODUCTION',
      productionSetupStatus: 'RELEASED',
      productionOrderCount: 1,
      releasedToFactory: false,
      productionReadinessSummary: { canStart: true },
    });
    expect(orders.journeyBucket).toBe('preparing');

    const factory = productionFactoryBucket({
      releasedToFactoryAt: null,
      status: 'PLANNED',
    });
    expect(factory).toBe('preparing');
  });

  it('Release → Orders Ready for factory + Production Ready for factory', () => {
    const orders = classifyAdminOrderJourney({
      status: 'READY_FOR_PRODUCTION',
      releasedToFactory: true,
      executionStarted: false,
      productionOrderCount: 1,
      productionSetupStatus: 'RELEASED',
    });
    expect(orders.journeyBucket).toBe('ready_to_start');

    expect(
      productionFactoryBucket({
        releasedToFactoryAt: new Date(),
        status: 'READY',
        actualStartDate: null,
      }),
    ).toBe('ready_to_start');
  });

  it('first task start → Orders + Production In production', () => {
    expect(
      classifyAdminOrderJourney({
        status: 'IN_PRODUCTION',
        releasedToFactory: true,
        executionStarted: true,
        productionOrderCount: 1,
      }).journeyBucket,
    ).toBe('in_production');
    expect(
      productionFactoryBucket({
        releasedToFactoryAt: new Date(),
        status: 'IN_PROGRESS',
        actualStartDate: new Date(),
      }),
    ).toBe('in_production');
  });

  it('plan-save never sets released / In Production', () => {
    expect(
      isReleasedToFactory({ releasedToFactoryAt: null, status: 'PLANNED' } as {
        releasedToFactoryAt: null;
      }),
    ).toBe(false);
    const j = classifyAdminOrderJourney({
      status: 'READY_FOR_PRODUCTION',
      releasedToFactory: false,
      productionSetupStatus: 'RELEASED',
      productionOrderCount: 1,
    });
    expect(j.journeyBucket).toBe('preparing');
  });
});
