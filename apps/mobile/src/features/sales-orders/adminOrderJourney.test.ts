import { classifyAdminOrderJourney } from './adminOrderJourney';

describe('classifyAdminOrderJourney — Release to factory boundary', () => {
  it('Preparing = DRAFT + 0 POs (setup required)', () => {
    const j = classifyAdminOrderJourney({
      status: 'DRAFT',
      productionSetupRequired: true,
      productionOrderCount: 0,
      productionSetupStatus: 'SETUP_REQUIRED',
    });
    expect(j.journeyBucket).toBe('preparing');
    expect(j.primaryCta).toBe('continue_setup');
  });

  it('setup RELEASED + POs still Preparing until factory release', () => {
    const j = classifyAdminOrderJourney({
      status: 'READY_FOR_PRODUCTION',
      productionSetupRequired: false,
      productionOrderCount: 2,
      productionSetupStatus: 'RELEASED',
      releasedToFactory: false,
      executionStarted: false,
      productionReadinessSummary: {
        canStart: false,
        needsSetup: true,
        assignment: { missingCount: 2, required: 2, assigned: 0 },
      },
    });
    expect(j.journeyBucket).toBe('preparing');
    expect(j.primaryCta).toBe('assign_workers');
  });

  it('plan ready but not released → Preparing + Release CTA', () => {
    const j = classifyAdminOrderJourney({
      status: 'READY_FOR_PRODUCTION',
      productionSetupStatus: 'RELEASED',
      productionOrderCount: 1,
      releasedToFactory: false,
      executionStarted: false,
      productionReadinessSummary: { canStart: true, needsSetup: false },
    });
    expect(j.journeyBucket).toBe('preparing');
    expect(j.primaryCta).toBe('release');
  });

  it('Release to factory → Ready to start (not In Production)', () => {
    const j = classifyAdminOrderJourney({
      status: 'READY_FOR_PRODUCTION',
      productionSetupStatus: 'RELEASED',
      productionOrderCount: 1,
      releasedToFactory: true,
      releasedToFactoryAt: '2026-08-01T10:00:00.000Z',
      executionStarted: false,
    });
    expect(j.journeyBucket).toBe('ready_to_start');
    expect(j.journeyBucket).not.toBe('in_production');
    expect(j.primaryCta).toBe('edit_plan');
  });

  it('first task start → Orders In Production', () => {
    const j = classifyAdminOrderJourney({
      status: 'IN_PRODUCTION',
      productionSetupStatus: 'RELEASED',
      productionOrderCount: 1,
      releasedToFactory: true,
      executionStarted: true,
    });
    expect(j.journeyBucket).toBe('in_production');
  });

  it('plan-save alone (READY_FOR_PRODUCTION, no release) never Ready/In Production', () => {
    const j = classifyAdminOrderJourney({
      status: 'READY_FOR_PRODUCTION',
      productionSetupStatus: 'RELEASED',
      productionOrderCount: 1,
      releasedToFactory: false,
      executionStarted: false,
      productionReadinessSummary: { canStart: true },
    });
    expect(j.journeyBucket).toBe('preparing');
  });

  it('hold/overdue stay on home bucket with soft attention badge (no Attention chip)', () => {
    const j = classifyAdminOrderJourney({
      status: 'ON_HOLD',
      productionOrderCount: 1,
      releasedToFactory: true,
      executionStarted: true,
    });
    expect(j.journeyBucket).toBe('in_production');
    expect(j.journeyBucket).not.toBe('needs_attention');
    expect(j.attention).toBeDefined();
    expect(j.attention?.reasonLabelKey).toBe('mobile.orders.attention.ON_HOLD');
  });

  it('RFQ = rfq', () => {
    const j = classifyAdminOrderJourney({
      status: 'SUBMITTED',
      isRfq: true,
    });
    expect(j.journeyBucket).toBe('rfq');
    expect(j.primaryCta).toBe('review_request');
  });
});
