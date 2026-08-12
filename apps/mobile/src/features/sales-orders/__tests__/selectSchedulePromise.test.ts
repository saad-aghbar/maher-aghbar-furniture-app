import type { OwnOrderSchedule } from '@/api/modules/scheduling';
import { selectChangeDateCta, selectOrderPromiseSummary } from '../selectSchedulePromise';

function schedule(overrides: Partial<OwnOrderSchedule> = {}): OwnOrderSchedule {
  return {
    productionOrderId: 'po-1',
    number: 'PO-0001',
    promiseState: 'ESTIMATED',
    requestedDeliveryDate: null,
    suggestedDeliveryDate: null,
    committedDeliveryDate: null,
    canUpdateDeliveryDate: false,
    canRequestDateChange: false,
    dateChangeLocked: false,
    dateChangeReason: '',
    ...overrides,
  };
}

describe('selectChangeDateCta', () => {
  it('is hidden with no schedule yet', () => {
    expect(selectChangeDateCta(null)).toEqual({ mode: 'hidden', labelKey: '' });
  });

  it('allows a direct update before approval', () => {
    const cta = selectChangeDateCta(schedule({ canUpdateDeliveryDate: true }));
    expect(cta.mode).toBe('update');
  });

  it('falls back to a change request once approved', () => {
    const cta = selectChangeDateCta(
      schedule({ canUpdateDeliveryDate: false, canRequestDateChange: true }),
    );
    expect(cta.mode).toBe('request');
  });

  it('is locked once in production / completed / cancelled', () => {
    const cta = selectChangeDateCta(
      schedule({ canUpdateDeliveryDate: false, canRequestDateChange: false, dateChangeLocked: true }),
    );
    expect(cta.mode).toBe('locked');
  });

  it('prefers direct update over request when both flags are somehow set', () => {
    const cta = selectChangeDateCta(
      schedule({ canUpdateDeliveryDate: true, canRequestDateChange: true }),
    );
    expect(cta.mode).toBe('update');
  });
});

describe('selectOrderPromiseSummary', () => {
  it('returns null with no schedule', () => {
    expect(selectOrderPromiseSummary(null)).toBeNull();
  });

  it('flags estimate-only when no committed date exists yet', () => {
    const summary = selectOrderPromiseSummary(
      schedule({ suggestedDeliveryDate: '2026-09-01', committedDeliveryDate: null }),
    );
    expect(summary?.showEstimateOnly).toBe(true);
  });

  it('does not flag estimate-only once a date is committed', () => {
    const summary = selectOrderPromiseSummary(
      schedule({
        suggestedDeliveryDate: '2026-09-01',
        committedDeliveryDate: '2026-09-03',
        promiseState: 'CONFIRMED',
      }),
    );
    expect(summary?.showEstimateOnly).toBe(false);
    expect(summary?.committedDeliveryDate).toBe('2026-09-03');
  });
});
