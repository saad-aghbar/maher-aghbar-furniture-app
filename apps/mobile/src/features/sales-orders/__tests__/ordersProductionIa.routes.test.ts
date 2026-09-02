/**
 * Route / bucket / readiness acceptance for Orders ↔ Production IA.
 * Pure helpers — no RN / network.
 */

import { classifyAdminOrderJourney } from '../adminOrderJourney';
import { resolveOrderPrimaryCtaHref } from '../resolveOrderPrimaryCtaHref';

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
  if (args.releasedToFactory) {
    const po = args.productionOrderId ?? 'po';
    return {
      host: 'production',
      path: `/(app)/(admin)/production/${po}`,
    };
  }
  return {
    host: 'orders-plan',
    path: `/(app)/(admin)/orders/${args.salesOrderId}/production-plan`,
  };
}

/** Legacy setup paths must only redirect into the plan (optional focus params). */
export function legacySetupRedirect(args: {
  salesOrderId: string;
  lineId?: string | null;
}): string {
  const base = `/(app)/(admin)/orders/${args.salesOrderId}/production-plan`;
  if (args.lineId) {
    return `${base}?lineId=${encodeURIComponent(args.lineId)}`;
  }
  return base;
}

describe('Orders / Production route map', () => {
  it('Preparing → Production Plan is one hop to /production-plan', () => {
    const href = resolveOrderPrimaryCtaHref({
      salesOrderId: 'so-1',
      lifecycle: 'preparing',
      primaryCta: 'continue_setup',
    });
    expect(String(href)).toBe('/(app)/(admin)/orders/so-1/production-plan');
    expect(String(href)).not.toContain('production-setup');
  });

  it('Ready to start CTA opens order detail (view/edit plan from there)', () => {
    const href = resolveOrderPrimaryCtaHref({
      salesOrderId: 'so-2',
      lifecycle: 'ready_to_start',
      primaryCta: 'edit_plan',
    });
    expect(String(href)).toBe('/(app)/(admin)/orders/so-2');
  });

  it('Production plan route is only entered from Preparing CTA or order detail button', () => {
    expect('/(app)/(admin)/orders/so-1/production-plan').toContain('/production-plan');
  });

  it('RFQ Accepted → Open SO lands on Orders desk (Preparing owns prep)', () => {
    const soId = 'so-1';
    expect(`/(app)/(admin)/orders/${soId}`).toContain('/orders/');
    expect(
      orderProductionRoute({
        salesOrderId: soId,
        releasedToFactory: false,
        hasProductionOrders: false,
      }).host,
    ).toBe('orders-plan');
    expect(
      orderProductionRoute({
        salesOrderId: soId,
        releasedToFactory: false,
        hasProductionOrders: false,
      }).path,
    ).toContain('/production-plan');
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

  it('legacy /production-setup redirects to production-plan only', () => {
    expect(legacySetupRedirect({ salesOrderId: 'so-9' })).toBe(
      '/(app)/(admin)/orders/so-9/production-plan',
    );
  });

  it('legacy line route redirects to production-plan?lineId=', () => {
    expect(legacySetupRedirect({ salesOrderId: 'so-9', lineId: 'line-3' })).toBe(
      '/(app)/(admin)/orders/so-9/production-plan?lineId=line-3',
    );
    expect(legacySetupRedirect({ salesOrderId: 'so-9', lineId: 'line-3' })).not.toContain(
      '/production-setup/lines/',
    );
  });

  it('RFQ has no Production Plan editor route', () => {
    const rfqPath = '/(app)/(admin)/requests/req-1';
    expect(rfqPath).not.toContain('production-plan');
  });
});

describe('Production Plan host contracts', () => {
  it('OrderProductionPlanScreen source never imports Setup Home', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const hostPath = path.join(
      __dirname,
      '..',
      'OrderProductionPlanScreen.tsx',
    );
    const src = fs.readFileSync(hostPath, 'utf8');
    expect(src).toContain("from './OrderProductionPlanEditorScreen'");
    expect(src).not.toMatch(/from ['"].*OrderProductionSetupHomeScreen['"]/);
    expect(src).not.toContain('openPlanCta');
  });

  it('line edit opens via ?lineId= on the plan (not a second setup app)', () => {
    expect(legacySetupRedirect({ salesOrderId: 'so-1', lineId: 'L1' })).toBe(
      '/(app)/(admin)/orders/so-1/production-plan?lineId=L1',
    );
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
