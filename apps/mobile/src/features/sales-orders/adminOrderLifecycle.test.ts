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

  it('flags missing workers as needs_attention', () => {
    expect(
      classifyAdminOrderLifecycle({
        status: 'CONFIRMED',
        productionReadinessSummary: {
          needsSetup: true,
          assignment: { missingCount: 2 },
        },
      }),
    ).toBe('needs_attention');
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

  it('ready_to_start when canStart on confirmed SO', () => {
    expect(
      classifyAdminOrderLifecycle({
        status: 'READY_FOR_PRODUCTION',
        productionReadinessSummary: { canStart: true, needsSetup: false },
      }),
    ).toBe('ready_to_start');
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
