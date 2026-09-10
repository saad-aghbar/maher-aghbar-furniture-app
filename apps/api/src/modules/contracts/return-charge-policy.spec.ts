import {
  chargeShapeFor,
  nextChargeStatus,
  productionBlockedBy,
  shouldResetChargeStamps,
  validateChargeInput,
} from './return-charge-policy';

describe('return-charge-policy', () => {
  it('describes the per-responsibility shape', () => {
    expect(chargeShapeFor('FACTORY_WARRANTY')).toEqual({
      dealerAmountRequired: false,
      factoryAmountRequired: false,
      needsDealerConfirmation: false,
    });
    expect(chargeShapeFor('DEALER_RESPONSIBILITY').dealerAmountRequired).toBe(true);
    expect(chargeShapeFor('SHARED')).toEqual({
      dealerAmountRequired: true,
      factoryAmountRequired: true,
      needsDealerConfirmation: true,
    });
    expect(chargeShapeFor('UNDETERMINED').dealerAmountRequired).toBe(false);
  });

  it('forces factory warranty amounts to null', () => {
    expect(validateChargeInput('FACTORY_WARRANTY', 80, 20)).toEqual({
      ok: true,
      dealerAmount: null,
      factoryAmount: null,
    });
  });

  it('requires a dealer amount when charging the dealer', () => {
    expect(validateChargeInput('DEALER_RESPONSIBILITY', 0, null)).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(validateChargeInput('DEALER_RESPONSIBILITY', 80, 20)).toEqual({
      ok: true,
      dealerAmount: 80,
      factoryAmount: null,
    });
  });

  it('requires both shares for a shared charge', () => {
    expect(validateChargeInput('SHARED', 40, null)).toMatchObject({ ok: false });
    expect(validateChargeInput('SHARED', 40, 60)).toEqual({
      ok: true,
      dealerAmount: 40,
      factoryAmount: 60,
    });
  });

  it('treats an undetermined amount as optional', () => {
    expect(validateChargeInput('UNDETERMINED', null, null)).toEqual({
      ok: true,
      dealerAmount: null,
      factoryAmount: null,
    });
    expect(validateChargeInput('UNDETERMINED', 25, null)).toEqual({
      ok: true,
      dealerAmount: 25,
      factoryAmount: null,
    });
  });

  it('maps the next status from responsibility and dealer amount', () => {
    expect(nextChargeStatus('FACTORY_WARRANTY', null)).toBe('NOT_REQUIRED');
    expect(nextChargeStatus('DEALER_RESPONSIBILITY', 80)).toBe('DRAFT');
    expect(nextChargeStatus('UNDETERMINED', null)).toBe('NOT_REQUIRED');
    expect(nextChargeStatus('UNDETERMINED', 40)).toBe('DRAFT');
    expect(nextChargeStatus('SHARED', 20, 'INVOICED')).toBe('INVOICED');
  });

  it('blocks production only while a dealer charge is unresolved', () => {
    expect(productionBlockedBy('NOT_REQUIRED')).toBeNull();
    expect(productionBlockedBy('CONFIRMED')).toBeNull();
    expect(productionBlockedBy('INVOICED')).toBeNull();
    expect(productionBlockedBy(undefined)).toBeNull();
    expect(productionBlockedBy('DRAFT')).toMatch(/Confirm the dealer charge/);
    expect(productionBlockedBy('AWAITING_DEALER')).toBeTruthy();
    expect(productionBlockedBy('REJECTED')).toBeTruthy();
  });

  it('resets confirmation stamps when a live charge is edited', () => {
    expect(
      shouldResetChargeStamps({
        current: 'CONFIRMED',
        responsibilityChanged: false,
        amountsChanged: true,
      }),
    ).toBe(true);
    expect(
      shouldResetChargeStamps({
        current: 'AWAITING_DEALER',
        responsibilityChanged: true,
        amountsChanged: false,
      }),
    ).toBe(true);
    expect(
      shouldResetChargeStamps({
        current: 'CONFIRMED',
        responsibilityChanged: false,
        amountsChanged: false,
      }),
    ).toBe(false);
    expect(
      shouldResetChargeStamps({
        current: 'INVOICED',
        responsibilityChanged: true,
        amountsChanged: true,
      }),
    ).toBe(false);
  });
});
