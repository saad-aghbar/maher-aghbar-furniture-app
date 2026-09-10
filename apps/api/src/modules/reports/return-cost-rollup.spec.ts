import { lifetimeCost, originBucket, recoveryOutcomeValue } from './return-cost-rollup';

describe('return-cost-rollup', () => {
  it('keeps recovered and disposed value as separate figures', () => {
    const result = recoveryOutcomeValue([
      { outcome: 'RECOVER_TO_INVENTORY', quantity: 2, unitCost: 10, postedAt: new Date() },
      { outcome: 'DISPOSE', quantity: 1, unitCost: 8, postedAt: new Date() },
      { outcome: 'RECOVER_TO_INVENTORY', quantity: 3, unitCost: null, postedAt: new Date() },
    ]);
    expect(result.recoveredQty).toBe(5);
    expect(result.disposedQty).toBe(1);
    expect(result.recoveredValue).toBe(20);
    expect(result.disposedValue).toBe(8);
    expect((result.recoveredValue ?? 0) - (result.disposedValue ?? 0)).not.toBe(result.recoveredValue);
  });

  it('shows quantity only when recovered lines have no valuation', () => {
    const result = recoveryOutcomeValue([
      { outcome: 'RECOVER_TO_INVENTORY', quantity: 4, unitCost: 0, postedAt: new Date() },
    ]);
    expect(result.recoveredQty).toBe(4);
    expect(result.recoveredValue).toBeNull();
  });

  it('maps originType into repair / replacement / recovery', () => {
    expect(originBucket('RETURN_WORK')).toBe('repair');
    expect(originBucket('REPLACEMENT')).toBe('replacement');
    expect(originBucket('RETURN_RECOVERY')).toBe('recovery');
  });

  it('adds original production and after-sale return cost without netting recovery', () => {
    expect(lifetimeCost(100, 25)).toBe(125);
    expect(lifetimeCost(null, 25)).toBe(25);
  });
});
