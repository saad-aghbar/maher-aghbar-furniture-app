import type { ReturnChargeStatus, ReturnResponsibility } from '@maher/database';

export type ChargeShape = {
  dealerAmountRequired: boolean;
  factoryAmountRequired: boolean;
  needsDealerConfirmation: boolean;
};

export type ChargeValidation =
  | { ok: true; dealerAmount: number | null; factoryAmount: number | null }
  | { ok: false; code: string; message: string };

const OPEN_CHARGE_STATES: ReturnChargeStatus[] = [
  'AWAITING_DEALER',
  'CONFIRMED',
  'REJECTED',
];

export function chargeShapeFor(responsibility: ReturnResponsibility): ChargeShape {
  switch (responsibility) {
    case 'DEALER_RESPONSIBILITY':
      return {
        dealerAmountRequired: true,
        factoryAmountRequired: false,
        needsDealerConfirmation: true,
      };
    case 'SHARED':
      return {
        dealerAmountRequired: true,
        factoryAmountRequired: true,
        needsDealerConfirmation: true,
      };
    case 'UNDETERMINED':
      return {
        dealerAmountRequired: false,
        factoryAmountRequired: false,
        needsDealerConfirmation: true,
      };
    case 'FACTORY_WARRANTY':
    default:
      return {
        dealerAmountRequired: false,
        factoryAmountRequired: false,
        needsDealerConfirmation: false,
      };
  }
}

export function parseChargeMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function validateChargeInput(
  responsibility: ReturnResponsibility,
  dealerAmount?: number | null,
  factoryAmount?: number | null,
): ChargeValidation {
  const dealer = parseChargeMoney(dealerAmount);
  const factory = parseChargeMoney(factoryAmount);

  if (responsibility === 'FACTORY_WARRANTY') {
    return { ok: true, dealerAmount: null, factoryAmount: null };
  }

  if (dealer != null && dealer < 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Charge amount cannot be negative.' };
  }
  if (factory != null && factory < 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Factory share cannot be negative.' };
  }

  if (responsibility === 'DEALER_RESPONSIBILITY') {
    if (!(dealer != null && dealer > 0)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Dealer charge amount must be greater than zero.',
      };
    }
    return { ok: true, dealerAmount: dealer, factoryAmount: null };
  }

  if (responsibility === 'SHARED') {
    if (!(dealer != null && dealer > 0)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Dealer share must be greater than zero.',
      };
    }
    if (!(factory != null && factory > 0)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Factory share must be greater than zero.',
      };
    }
    return { ok: true, dealerAmount: dealer, factoryAmount: factory };
  }

  return {
    ok: true,
    dealerAmount: dealer != null && dealer > 0 ? dealer : null,
    factoryAmount: null,
  };
}

export function nextChargeStatus(
  responsibility: ReturnResponsibility,
  dealerAmount: number | null,
  current?: ReturnChargeStatus | null,
): ReturnChargeStatus {
  if (current === 'INVOICED') return 'INVOICED';
  if (responsibility === 'FACTORY_WARRANTY') return 'NOT_REQUIRED';
  if (dealerAmount != null && dealerAmount > 0) return 'DRAFT';
  return 'NOT_REQUIRED';
}

export function productionBlockedBy(
  chargeStatus: ReturnChargeStatus | string | null | undefined,
): string | null {
  if (chargeStatus === 'DRAFT' || chargeStatus === 'AWAITING_DEALER' || chargeStatus === 'REJECTED') {
    return 'Confirm the dealer charge before starting factory work.';
  }
  return null;
}

export function moneyEquals(left: unknown, right: unknown): boolean {
  return Number(left ?? 0) === Number(right ?? 0);
}

export function shouldResetChargeStamps(params: {
  current: ReturnChargeStatus | string | null | undefined;
  responsibilityChanged: boolean;
  amountsChanged: boolean;
}): boolean {
  if (params.current === 'INVOICED') return false;
  if (!OPEN_CHARGE_STATES.includes(params.current as ReturnChargeStatus)) return false;
  return params.responsibilityChanged || params.amountsChanged;
}

export function assertChargeUnlocked(chargeStatus: ReturnChargeStatus | string | null | undefined) {
  return chargeStatus === 'INVOICED';
}
