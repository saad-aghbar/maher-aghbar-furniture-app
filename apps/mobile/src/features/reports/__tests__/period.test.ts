import { rangeForPreset } from '../period';

describe('rangeForPreset', () => {
  it('returns same day for today', () => {
    const { from, to } = rangeForPreset('today');
    expect(from).toBe(to);
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns month starting on the 1st', () => {
    const { from, to } = rangeForPreset('month');
    expect(from.endsWith('-01')).toBe(true);
    expect(from <= to).toBe(true);
  });

  it('returns week from Monday through today', () => {
    const { from, to } = rangeForPreset('week');
    expect(from <= to).toBe(true);
    const fromDate = new Date(`${from}T00:00:00`);
    expect(fromDate.getDay()).toBe(1);
  });
});
