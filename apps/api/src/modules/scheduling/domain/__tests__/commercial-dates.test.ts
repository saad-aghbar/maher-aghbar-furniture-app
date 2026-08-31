import {
  assertCommercialDateWrite,
  commercialDateAction,
  isDeliveryOverdue,
  toCommercialYmd,
} from '../commercial-dates';

describe('commercial dates', () => {
  it('treats first confirm of the requested day as confirm (no reason)', () => {
    expect(commercialDateAction(null, '2026-09-22', '2026-09-22')).toBe('confirm');
    const write = assertCommercialDateWrite({
      previousOfferedYmd: null,
      requestedYmd: '2026-09-22',
      nextYmd: '2026-09-22',
    });
    expect(write).toEqual({ ok: true, action: 'confirm', reasonRequired: false });
  });

  it('requires a reason when the offered day changes', () => {
    const write = assertCommercialDateWrite({
      previousOfferedYmd: '2026-09-22',
      requestedYmd: '2026-09-22',
      nextYmd: '2026-09-24',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.code).toBe('REASON_REQUIRED');
    const withReason = assertCommercialDateWrite({
      previousOfferedYmd: '2026-09-22',
      nextYmd: '2026-09-24',
      reason: 'Upholstery load',
    });
    expect(withReason).toEqual({ ok: true, action: 'change', reasonRequired: true });
  });

  it('marks overdue without rewriting the committed ymd', () => {
    expect(isDeliveryOverdue('2026-09-24', '2026-09-25')).toBe(true);
    expect(isDeliveryOverdue('2026-09-24', '2026-09-24')).toBe(false);
    expect(toCommercialYmd('2026-09-24T13:00:00.000Z')).toBe('2026-09-24');
  });
});
