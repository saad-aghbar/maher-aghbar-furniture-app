import { isScheduledToday } from '../isScheduledToday';

// Built from local Date components (not raw UTC ISO strings) so this test is
// stable regardless of the runner's timezone.
const now = new Date(2026, 7, 11, 9, 0, 0);
const sameDayLater = new Date(2026, 7, 11, 22, 59, 0);
const sameDayEarlier = new Date(2026, 7, 11, 0, 0, 1);
const yesterday = new Date(2026, 7, 10, 23, 59, 59);
const tomorrow = new Date(2026, 7, 12, 0, 0, 0);

describe('isScheduledToday', () => {
  it('is false for null/undefined input', () => {
    expect(isScheduledToday(null, now)).toBe(false);
    expect(isScheduledToday(undefined, now)).toBe(false);
  });

  it('is false for an invalid date string', () => {
    expect(isScheduledToday('not-a-date', now)).toBe(false);
  });

  it('is true when the ISO timestamp falls on the same local calendar day', () => {
    expect(isScheduledToday(sameDayLater.toISOString(), now)).toBe(true);
    expect(isScheduledToday(sameDayEarlier.toISOString(), now)).toBe(true);
  });

  it('is false for yesterday or tomorrow', () => {
    expect(isScheduledToday(yesterday.toISOString(), now)).toBe(false);
    expect(isScheduledToday(tomorrow.toISOString(), now)).toBe(false);
  });
});
