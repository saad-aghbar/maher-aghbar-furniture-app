import {
  JOURNEY_LANE_FIXTURES,
  cardFromFixture,
  journeyFromFixture,
  type JourneyLaneFixtureName,
} from '../journeyLaneFixtures';
import { buildLaneCardPresentation } from '../laneOrderCard';

const EXPECTED_BUCKET: Record<JourneyLaneFixtureName, string> = {
  PREPARING_SPEC_INCOMPLETE: 'preparing',
  PREPARING_MATERIALS_INCOMPLETE: 'preparing',
  PREPARING_WORKERS_INCOMPLETE: 'preparing',
  PREPARING_DATES_INCOMPLETE: 'preparing',
  PREPARING_WARNING_ONLY: 'preparing',
  READY_TO_START: 'ready_to_start',
  IN_PRODUCTION: 'in_production',
  ATTENTION: 'preparing',
  READY_FOR_DELIVERY: 'ready_to_ship',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
};

describe('journeyLaneFixtures', () => {
  it.each(Object.keys(JOURNEY_LANE_FIXTURES) as JourneyLaneFixtureName[])(
    '%s classifies to expected bucket',
    (name) => {
      const journey = journeyFromFixture(name);
      expect(journey.journeyBucket).toBe(EXPECTED_BUCKET[name]);
      const card = cardFromFixture(name);
      expect(card.lifecycle ?? journey.journeyBucket).toBe(EXPECTED_BUCKET[name]);
    },
  );

  it('lane cards expose stage-specific CTAs', () => {
    const t = (key: string) => key;
    const prep = buildLaneCardPresentation(
      {
        lifecycle: 'preparing',
        number: 'SO-1',
        primaryCta: 'continue_setup',
        needsSetup: true,
      },
      t,
    );
    expect(prep.ctaLabelKey).toBe('mobile.productionSetup.planTitle');

    const ready = buildLaneCardPresentation(
      {
        lifecycle: 'ready_to_start',
        number: 'SO-2',
        primaryCta: 'edit_plan',
      },
      t,
    );
    expect(ready.ctaLabelKey).toBe('mobile.orders.journey.viewPlan');

    const prod = buildLaneCardPresentation(
      {
        lifecycle: 'in_production',
        number: 'SO-3',
        progressLabel: 'Carpentry',
        progressPercent: 40,
      },
      t,
    );
    expect(prod.ctaLabelKey).toBe('mobile.orders.cta.openProduction');

    const loading = buildLaneCardPresentation(
      {
        lifecycle: 'ready_to_ship',
        number: 'SO-1042',
        packagesLoaded: 6,
        packagesTotal: 8,
        loadStatus: 'loading',
        missingPackageIndex: 7,
      },
      t,
    );
    expect(loading.ctaLabelKey).toBe('mobile.orders.cta.openLoad');
    expect(loading.blockers).toContain('mobile.orders.packageMissingOf');

    const fullyLoaded = buildLaneCardPresentation(
      {
        lifecycle: 'ready_to_ship',
        number: 'SO-1042',
        packagesLoaded: 8,
        packagesTotal: 8,
        loadStatus: 'fully_loaded',
      },
      t,
    );
    expect(fullyLoaded.ctaLabelKey).toBe('mobile.orders.cta.openDelivery');
    expect(fullyLoaded.facts.some((f) => f.key === 'readyDepart')).toBe(true);
  });
});
