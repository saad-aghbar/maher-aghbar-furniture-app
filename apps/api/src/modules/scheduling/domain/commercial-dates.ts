/** Commercial delivery dates are never rewritten by factory condition changes. */

export type CommercialDateAction = 'confirm' | 'change';

export type CommercialDateWrite =
  | { ok: true; action: CommercialDateAction; reasonRequired: false }
  | { ok: true; action: 'change'; reasonRequired: true }
  | { ok: false; code: 'REASON_REQUIRED' | 'INVALID_DATE' };

const YMD = /^(\d{4}-\d{2}-\d{2})/;

export function toCommercialYmd(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const match = YMD.exec(value.trim());
  return match?.[1] ?? null;
}

export function commercialDateAction(
  previousOfferedYmd: string | null,
  nextYmd: string,
  requestedYmd?: string | null,
): CommercialDateAction {
  const previous = previousOfferedYmd ?? requestedYmd ?? null;
  if (!previous || previous === nextYmd) return 'confirm';
  return 'change';
}

/**
 * Confirm same calendar day: no reason.
 * Change to a different day (or later reschedule of an existing offered/committed date): reason required.
 */
export function assertCommercialDateWrite(input: {
  previousOfferedYmd: string | null;
  requestedYmd?: string | null;
  nextYmd: string | null;
  reason?: string | null;
}): CommercialDateWrite {
  const next = toCommercialYmd(input.nextYmd);
  if (!next) return { ok: false, code: 'INVALID_DATE' };
  const action = commercialDateAction(input.previousOfferedYmd, next, input.requestedYmd ?? null);
  if (action === 'confirm') {
    return { ok: true, action: 'confirm', reasonRequired: false };
  }
  const reason = input.reason?.trim() ?? '';
  if (reason.length < 1) return { ok: false, code: 'REASON_REQUIRED' };
  return { ok: true, action: 'change', reasonRequired: true };
}

/** Promised day has passed. Never rewrite the committed date to look healthy. */
export function isDeliveryOverdue(committedYmd: string | null, todayYmd: string): boolean {
  if (!committedYmd) return false;
  return committedYmd < todayYmd;
}
