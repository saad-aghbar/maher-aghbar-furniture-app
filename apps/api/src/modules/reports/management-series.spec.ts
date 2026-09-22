import {
  averageStageDurations,
  bucketAmounts,
  bucketCounts,
  bucketQuality,
  dayKeys,
  localDayKey,
} from './management-series';

function at(y: number, m: number, d: number, h = 10): Date {
  return new Date(y, m - 1, d, h, 0, 0, 0);
}

describe('management-series bucketing', () => {
  const start = at(2026, 9, 15, 0);

  it('emits one zero-filled key per day in the window', () => {
    const keys = dayKeys(start, 7);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-09-15');
    expect(keys[6]).toBe('2026-09-21');
  });

  it('counts rows into their local day and ignores rows outside the window', () => {
    const rows = [
      { at: at(2026, 9, 15, 8) },
      { at: at(2026, 9, 15, 23) },
      { at: at(2026, 9, 17) },
      { at: at(2026, 9, 30) },
      { at: null },
    ];
    const series = bucketCounts(rows, (r) => r.at, start, 7);
    expect(series.map((p) => p.count)).toEqual([2, 0, 1, 0, 0, 0, 0]);
  });

  it('sums amounts per day with 3-decimal rounding', () => {
    const rows = [
      { at: at(2026, 9, 16), amount: '100.1234' },
      { at: at(2026, 9, 16), amount: 50 },
      { at: at(2026, 9, 18), amount: Number.NaN },
    ];
    const series = bucketAmounts(rows, (r) => r.at, (r) => Number(r.amount), start, 4);
    expect(series[1]).toEqual({ date: '2026-09-16', amount: 150.123 });
    expect(series[3]).toEqual({ date: '2026-09-18', amount: 0 });
  });

  it('splits quality results into passed / failed and skips null results', () => {
    const rows = [
      { at: at(2026, 9, 15), result: 'PASSED' },
      { at: at(2026, 9, 15), result: 'PASSED_WITH_NOTES' },
      { at: at(2026, 9, 15), result: 'FAILED_REWORK_REQUIRED' },
      { at: at(2026, 9, 16), result: 'BLOCKED' },
      { at: at(2026, 9, 16), result: null },
    ];
    const series = bucketQuality(rows, (r) => r.at, (r) => r.result, start, 2);
    expect(series).toEqual([
      { date: '2026-09-15', passed: 2, failed: 1 },
      { date: '2026-09-16', passed: 0, failed: 1 },
    ]);
  });

  it('averages stage minutes and sorts slowest first', () => {
    const rows = [
      { stage: { code: 'CARPENTRY', name: 'Carpentry' }, minutes: 120 },
      { stage: { code: 'CARPENTRY', name: 'Carpentry' }, minutes: 60 },
      { stage: { code: 'PAINTING', name: 'Painting' }, minutes: 200 },
      { stage: { code: 'FOAM', name: 'Foam' }, minutes: null },
      { stage: null, minutes: 40 },
    ];
    const out = averageStageDurations(rows, (r) => r.stage, (r) => r.minutes);
    expect(out).toEqual([
      { stageCode: 'PAINTING', stageName: 'Painting', avgMinutes: 200, samples: 1 },
      { stageCode: 'CARPENTRY', stageName: 'Carpentry', avgMinutes: 90, samples: 2 },
    ]);
  });

  it('localDayKey pads month and day', () => {
    expect(localDayKey(at(2026, 1, 5))).toBe('2026-01-05');
  });
});
