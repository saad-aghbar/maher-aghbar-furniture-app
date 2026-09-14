import { reportsPeriodRange } from '../selectReports';

describe('reportsPeriodRange', () => {
  it('returns same day for today', () => {
    const { from, to } = reportsPeriodRange('today', new Date(2026, 8, 14));
    expect(from).toBe(to);
    expect(from).toBe('2026-09-14');
  });

  it('returns month starting on the 1st', () => {
    const { from, to } = reportsPeriodRange('month', new Date(2026, 8, 14));
    expect(from).toBe('2026-09-01');
    expect(to).toBe('2026-09-14');
  });

  it('returns week from Sunday through today', () => {
    const wednesday = reportsPeriodRange('week', new Date(2026, 7, 12));
    expect(wednesday).toEqual({ from: '2026-08-09', to: '2026-08-12' });
    const fromDate = new Date(`${wednesday.from}T00:00:00`);
    expect(fromDate.getDay()).toBe(0);
  });
});
