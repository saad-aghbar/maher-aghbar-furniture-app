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
    // Working day after earliest with no chip and no days[] → not selectable
    expect(meta['2026-09-02']?.tone).toBe('busy');
    expect(meta['2026-09-02']?.disabled).toBe(true);
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

  it('never lets the dealer select a HIGH_LOAD day even when it is after earliest', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: {
        ...calculated,
        days: [
          { date: '2026-09-01', status: 'available', selectable: true, reason: null },
          { date: '2026-09-02', status: 'unavailable', selectable: false, reason: 'HIGH_LOAD' },
          { date: '2026-09-03', status: 'unavailable', selectable: false, reason: 'CLOSED_DAY' },
        ],
      },
    });
    const meta = selectAvailabilityDayMeta({
      display,
      year: 2026,
      monthIndex: 8,
    });
    expect(meta['2026-09-01']?.disabled).toBe(false);
    expect(meta['2026-09-02']?.disabled).toBe(true);
    expect(meta['2026-09-03']?.disabled).toBe(true);
  });

  it('disables today through day+3 and can still refuse day+4 via factory rules', () => {
    const display = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: {
        ...calculated,
        earliestAvailableDate: '2026-09-14',
        suggestedDeliveryDate: '2026-09-14',
        alternativeDates: ['2026-09-14', '2026-09-18'],
        minimumRequestDate: '2026-09-14',
        days: [
          { date: '2026-09-10', status: 'available', selectable: true, reason: null },
          { date: '2026-09-11', status: 'available', selectable: true, reason: null },
          { date: '2026-09-12', status: 'available', selectable: true, reason: null },
          { date: '2026-09-13', status: 'available', selectable: true, reason: null },
          { date: '2026-09-14', status: 'available', selectable: true, reason: null },
        ],
      },
    });
    const meta = selectAvailabilityDayMeta({
      display,
      year: 2026,
      monthIndex: 8,
    });
    expect(meta['2026-09-10']?.disabled).toBe(true);
    expect(meta['2026-09-11']?.disabled).toBe(true);
    expect(meta['2026-09-12']?.disabled).toBe(true);
    expect(meta['2026-09-13']?.disabled).toBe(true);
    expect(meta['2026-09-14']?.disabled).toBe(false);
    expect(display.minimumRequestDate).toBe('2026-09-14');

    const factoryBlocksDay4 = selectDeliveryAvailability({
      hasItems: true,
      isLoading: false,
      isError: false,
      result: {
        ...calculated,
        earliestAvailableDate: '2026-09-18',
        suggestedDeliveryDate: '2026-09-18',
        minimumRequestDate: '2026-09-14',
        days: [
          { date: '2026-09-14', status: 'unavailable', selectable: false, reason: 'TOO_EARLY' },
          { date: '2026-09-18', status: 'available', selectable: true, reason: null },
        ],
      },
    });
    const blocked = selectAvailabilityDayMeta({
      display: factoryBlocksDay4,
      year: 2026,
      monthIndex: 8,
    });
    expect(factoryBlocksDay4.earliestDate).toBe('2026-09-18');
    expect(blocked['2026-09-14']?.disabled).toBe(true);
    expect(blocked['2026-09-18']?.disabled).toBe(false);
  });
});
