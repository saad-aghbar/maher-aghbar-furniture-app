import {
  isReleasedToFactory,
  productionFactoryBucket,
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
