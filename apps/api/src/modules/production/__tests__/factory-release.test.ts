import {
  isReleasedToFactory,
  productionFactoryBucket,
  resolveProductionOrderRollupStatus,
} from '../factory-release';

describe('factory-release boundary', () => {
  it('unreleased PO stays preparing (not Production)', () => {
    expect(isReleasedToFactory({ releasedToFactoryAt: null, status: 'PLANNED' })).toBe(false);
    expect(productionFactoryBucket({ releasedToFactoryAt: null, status: 'READY' })).toBe(
      'preparing',
    );
  });

  it('Release to factory → Ready for factory (no task start yet)', () => {
    const po = {
      releasedToFactoryAt: new Date('2026-08-01T10:00:00Z'),
      status: 'READY',
      actualStartDate: null,
    };
    expect(isReleasedToFactory(po)).toBe(true);
    expect(productionFactoryBucket(po)).toBe('ready_to_start');
  });

  it('first real task start → In production', () => {
    expect(
      productionFactoryBucket({
        releasedToFactoryAt: new Date(),
        status: 'IN_PROGRESS',
        actualStartDate: new Date(),
      }),
    ).toBe('in_production');
  });

  it('plan-save alone (PLANNED, no release) never enters Production', () => {
    expect(
      productionFactoryBucket({
        releasedToFactoryAt: null,
        status: 'PLANNED',
        actualStartDate: null,
      }),
    ).toBe('preparing');
  });
});

describe('resolveProductionOrderRollupStatus', () => {
  it('keeps READY after Confirm unlock (no floor work yet)', () => {
    expect(
      resolveProductionOrderRollupStatus({
        allComplete: false,
        readyForDelivery: false,
        floorStarted: false,
        currentStatus: 'READY',
        releasedToFactoryAt: new Date('2026-09-01T10:00:00Z'),
      }),
    ).toBe('READY');
  });

  it('does not force IN_PROGRESS when only stages are READY', () => {
    expect(
      resolveProductionOrderRollupStatus({
        allComplete: false,
        readyForDelivery: false,
        floorStarted: false,
        currentStatus: 'READY',
        releasedToFactoryAt: new Date(),
      }),
    ).not.toBe('IN_PROGRESS');
  });

  it('moves to IN_PROGRESS once floor work has started', () => {
    expect(
      resolveProductionOrderRollupStatus({
        allComplete: false,
        readyForDelivery: false,
        floorStarted: true,
        currentStatus: 'READY',
        releasedToFactoryAt: new Date(),
      }),
    ).toBe('IN_PROGRESS');
  });
});
