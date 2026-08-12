import { resolveDealerChangePolicy } from '../dealer-change-policy';

describe('resolveDealerChangePolicy', () => {
  it('allows direct update when not approved and not started', () => {
    const policy = resolveDealerChangePolicy({
      promiseState: 'ESTIMATED',
      productionOrderStatus: 'PLANNED',
    });
    expect(policy.action).toBe('canUpdateDirect');
    expect(policy.canUpdateDirect).toBe(true);
    expect(policy.locked).toBe(false);
  });

  it('allows direct update for AWAITING_APPROVAL + READY', () => {
    const policy = resolveDealerChangePolicy({
      promiseState: 'AWAITING_APPROVAL',
      productionOrderStatus: 'READY',
    });
    expect(policy.action).toBe('canUpdateDirect');
  });

  it('requires change request when approved and not started', () => {
    const policy = resolveDealerChangePolicy({
      promiseState: 'CONFIRMED',
      productionOrderStatus: 'PLANNED',
    });
    expect(policy.action).toBe('canChangeRequest');
    expect(policy.canChangeRequest).toBe(true);
    expect(policy.canUpdateDirect).toBe(false);
  });

  it('locks when in production', () => {
    const policy = resolveDealerChangePolicy({
      promiseState: 'CONFIRMED',
      productionOrderStatus: 'IN_PROGRESS',
    });
    expect(policy.action).toBe('locked');
    expect(policy.locked).toBe(true);
  });

  it('locks completed and cancelled orders', () => {
    expect(
      resolveDealerChangePolicy({
        promiseState: 'COMPLETED',
        productionOrderStatus: 'COMPLETED',
      }).locked,
    ).toBe(true);
    expect(
      resolveDealerChangePolicy({
        promiseState: 'ESTIMATED',
        productionOrderStatus: 'CANCELLED',
      }).locked,
    ).toBe(true);
  });
});
