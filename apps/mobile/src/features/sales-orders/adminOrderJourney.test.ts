import { classifyAdminOrderJourney } from './adminOrderJourney';

describe('classifyAdminOrderJourney', () => {
  it('Preparing = DRAFT + 0 POs', () => {
    const j = classifyAdminOrderJourney({
      status: 'DRAFT',
      productionSetupRequired: true,
      productionOrderCount: 0,
      productionSetupStatus: 'SETUP_REQUIRED',
    });
    expect(j.journeyBucket).toBe('preparing');
    expect(j.primaryCta).toBe('continue_setup');
  });

  it('released leaves preparing', () => {
    const j = classifyAdminOrderJourney({
      status: 'DRAFT',
      productionSetupRequired: true,
      productionOrderCount: 0,
      productionSetupStatus: 'RELEASED',
    });
    expect(j.journeyBucket).not.toBe('preparing');
  });

  it('attention has reason + action', () => {
    const j = classifyAdminOrderJourney({
      status: 'ON_HOLD',
      productionOrderCount: 1,
    });
    expect(j.journeyBucket).toBe('needs_attention');
    expect(j.attention).toBeDefined();
    expect(j.attention?.reasonLabelKey).toBe('mobile.orders.attention.ON_HOLD');
    expect(j.attention?.actionLabelKey).toBe(
      'mobile.orders.attentionAction.view_hold',
    );
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
