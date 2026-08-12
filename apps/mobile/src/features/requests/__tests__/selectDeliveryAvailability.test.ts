import type { AvailabilityResult } from '@/api/modules/scheduling';
import {
  selectAvailabilityDayMeta,
  selectDeliveryAvailability,
  selectQuickPickDates,
  toDeliveryYmd,
} from '../selectDeliveryAvailability';

const calculated: AvailabilityResult = {
  estimateStatus: 'CALCULATED',
  earliestAvailableDate: '2026-09-01T13:00:00.000Z',
  requestedDateFeasible: true,
  suggestedDeliveryDate: '2026-09-01T13:00:00.000Z',
  alternativeDates: [
    '2026-09-05T13:00:00.000Z',
    '2026-09-10T00:00:00.000Z',
    '2026-09-15',
    '2026-09-20',
  ],
  estimateConfidence: 'HIGH',
  requiresAdminEstimateReview: false,
};

describe('selectDeliveryAvailability', () => {
  it('is idle when there are no items yet', () => {
    const display = selectDeliveryAvailability({
      hasItems: false,
      isLoading: false,
      isError: false,
      result: null,
    });
    expect(display.kind).toBe('idle');
  });

  it('is loading while the check is in flight and no result yet', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: true,
      isError: false,
      result: null,
    });
    expect(display.kind).toBe('loading');
  });

  it('surfaces errors distinctly from idle', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: true,
      result: null,
    });
    expect(display.kind).toBe('error');
  });

  it('is unavailable when the planner could not estimate', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: {
        estimateStatus: 'UNAVAILABLE',
        earliestAvailableDate: null,
        requestedDateFeasible: false,
        suggestedDeliveryDate: null,
        alternativeDates: [],
        estimateConfidence: 'LOW',
        requiresAdminEstimateReview: true,
      },
    });
    expect(display.kind).toBe('unavailable');
  });

  it('is feasible with no requested date (no preference yet)', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: calculated,
    });
    expect(display.kind).toBe('feasible');
    expect(display.earliestDate).toBe('2026-09-01');
    expect(display.alternativeDates).toEqual(['2026-09-05', '2026-09-10', '2026-09-15']);
  });

  it('is feasible when the requested date matches backend feasibility', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: calculated,
      requestedDeliveryDate: '2026-09-01',
    });
    expect(display.kind).toBe('feasible');
    expect(display.requestedDateFeasible).toBe(true);
  });

  it('is infeasible when the requested date cannot be met', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: { ...calculated, requestedDateFeasible: false },
      requestedDeliveryDate: '2026-08-15',
    });
    expect(display.kind).toBe('infeasible');
    expect(display.requestedDateFeasible).toBe(false);
    // Still surfaces the earliest/suggested date so the UI can offer it.
    expect(display.suggestedDate).toBe('2026-09-01');
  });

  it('flags preliminary estimates (missing product stage data)', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: { ...calculated, estimateStatus: 'PRELIMINARY', estimateConfidence: 'LOW' },
    });
    expect(display.isPreliminary).toBe(true);
  });
});

describe('selectQuickPickDates', () => {
  it('combines earliest + alternatives, de-duplicated and capped at 4', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: calculated,
    });
    const dates = selectQuickPickDates(display);
    expect(dates).toEqual(['2026-09-01', '2026-09-05', '2026-09-10', '2026-09-15']);
  });

  it('returns an empty list when idle', () => {
    const display = selectDeliveryAvailability({
      hasItems: false,
      isLoading: false,
      isError: false,
      result: null,
    });
    expect(selectQuickPickDates(display)).toEqual([]);
  });
});

describe('toDeliveryYmd', () => {
  it('strips ISO timestamps to YYYY-MM-DD', () => {
    expect(toDeliveryYmd('2026-08-26T13:00:00.000Z')).toBe('2026-08-26');
    expect(toDeliveryYmd('2026-08-26')).toBe('2026-08-26');
    expect(toDeliveryYmd('')).toBeNull();
    expect(toDeliveryYmd(undefined)).toBeNull();
  });
});

describe('selectAvailabilityDayMeta', () => {
  it('maps availability onto the shared admin load palette', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: calculated,
    });
    const meta = selectAvailabilityDayMeta({
      display,
      year: 2026,
      monthIndex: 8,
    });
    expect(meta['2026-09-01']?.tone).toBe('light');
    expect(meta['2026-09-01']?.isEarliest).toBe(true);
    // Fri soft-closed by default (factory Fri-only close); Sat works
    expect(meta['2026-09-04']?.tone).toBe('closed');
    expect(meta['2026-09-05']?.tone).toBe('half'); // Saturday alternative
    // Alternative Thursday → half
    expect(meta['2026-09-10']?.tone).toBe('half');
    // Working day after earliest with no chip → selectable empty
    expect(meta['2026-09-02']?.tone).toBe('empty');
    expect(meta['2026-09-02']?.disabled).toBe(false);
  });

  it('honors an explicit workingDays set', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: calculated,
    });
    const workingDays = new Set(['2026-09-01', '2026-09-05']);
    const meta = selectAvailabilityDayMeta({
      display,
      year: 2026,
      monthIndex: 8,
      workingDays,
    });
    expect(meta['2026-09-01']?.tone).toBe('light');
    expect(meta['2026-09-05']?.tone).toBe('half');
    expect(meta['2026-09-02']?.tone).toBe('closed');
  });
});
