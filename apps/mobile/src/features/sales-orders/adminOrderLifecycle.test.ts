import {
  ADMIN_LIFECYCLE_LABEL_FALLBACK,
  adminLifecycleActionHint,
  adminLifecycleHumanLabel,
  classifyAdminOrderLifecycle,
  type AdminOrderLifecycle,
} from './adminOrderLifecycle';

describe('adminOrderLifecycle', () => {
  it('classifies RFQ separately', () => {
    expect(classifyAdminOrderLifecycle({ status: 'SUBMITTED', isRfq: true })).toBe('rfq');
  });

  it('exposes Piece 13 human label fallbacks', () => {
    expect(ADMIN_LIFECYCLE_LABEL_FALLBACK.rfq).toBe('Customer Requests');
    expect(ADMIN_LIFECYCLE_LABEL_FALLBACK.ready_to_ship).toBe('Ready');
    expect(ADMIN_LIFECYCLE_LABEL_FALLBACK.ready_to_start).toBe('Ready to start');
    expect(ADMIN_LIFECYCLE_LABEL_FALLBACK.needs_attention).toBe('Attention');
    expect(adminLifecycleHumanLabel('shipped')).toBe('Shipped');
  });

  it('maps delivery OUT_FOR_DELIVERY to shipped', () => {
    expect(
      classifyAdminOrderLifecycle({
        status: 'READY_FOR_DELIVERY',
        deliveryStatus: 'OUT_FOR_DELIVERY',
      }),
    ).toBe('shipped');
  });

  it('missing workers soft-badge on In production (no Attention bucket)', () => {
    expect(
      classifyAdminOrderLifecycle({
        status: 'CONFIRMED',
        productionSetupStatus: 'RELEASED',
        productionOrderCount: 1,
        releasedToFactory: false,
        executionStarted: false,
        productionReadinessSummary: {
          needsSetup: true,
          assignment: { missingCount: 2 },
        },
      }),
    ).toBe('preparing');
    expect(
      classifyAdminOrderLifecycle({
        status: 'IN_PRODUCTION',
        releasedToFactory: true,
        executionStarted: true,
        productionOrderCount: 1,
        productionReadinessSummary: {
          needsSetup: true,
          assignment: { missingCount: 2 },
        },
      }),
    ).toBe('in_production');
  });

  it('maps DRAFT with 0 POs to preparing only', () => {
    expect(
      classifyAdminOrderLifecycle({
        status: 'DRAFT',
        productionSetupRequired: true,
        productionOrderCount: 0,
        productionSetupStatus: 'SETUP_IN_PROGRESS',
      }),
    ).toBe('preparing');
  });

  it('released not started → Ready to start; first start → In production', () => {
    expect(
      classifyAdminOrderLifecycle({
        status: 'READY_FOR_PRODUCTION',
        productionSetupStatus: 'RELEASED',
        productionOrderCount: 1,
        releasedToFactory: true,
        executionStarted: false,
        productionReadinessSummary: { canStart: true, needsSetup: false },
      }),
    ).toBe('ready_to_start');
    expect(
      classifyAdminOrderLifecycle({
        status: 'IN_PRODUCTION',
        releasedToFactory: true,
        executionStarted: true,
        productionOrderCount: 1,
      }),
    ).toBe('in_production');
  });

  it('plan-ready confirmed SO stays Preparing until Release to factory', () => {
    expect(
      classifyAdminOrderLifecycle({
        status: 'READY_FOR_PRODUCTION',
        productionSetupStatus: 'RELEASED',
        productionOrderCount: 1,
        releasedToFactory: false,
        executionStarted: false,
        productionReadinessSummary: { canStart: true, needsSetup: false },
      }),
    ).toBe('preparing');
  });

  it('builds action hints from readiness', () => {
    expect(
      adminLifecycleActionHint({
        status: 'CONFIRMED',
        productionReadinessSummary: { actionHint: '2 workers still need assignment' },
      }),
    ).toBe('2 workers still need assignment');
  });

  const all: AdminOrderLifecycle[] = [
    'needs_attention',
    'preparing',
    'ready_to_start',
    'in_production',
    'ready_to_ship',
    'shipped',
    'delivered',
    'rfq',
  ];
  it('covers lifecycle set', () => {
    expect(all.length).toBe(8);
  });
});
