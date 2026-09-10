import { resolveFactoryDayBounds } from '../production/production-day-lens';
import { completedDateWindow, completedOnFactoryDaysWhere } from './completed-date-filter';

describe('completedDateWindow', () => {
  const tz = 'Asia/Amman';

  it('uses factory-local bounds, not UTC midnight', () => {
    const window = completedDateWindow('2026-09-08', '2026-09-08', tz);
    const bounds = resolveFactoryDayBounds('2026-09-08', tz);
    expect(window).toEqual({ gte: bounds.start, lt: bounds.endExclusive });
    // 00:30 UTC on Sep 8 is still Sep 8 in Amman — inside the window.
    const utcMidnightPlus = new Date('2026-09-08T00:30:00.000Z');
    expect(utcMidnightPlus.getTime()).toBeGreaterThanOrEqual(window!.gte!.getTime());
    expect(utcMidnightPlus.getTime()).toBeLessThan(window!.lt!.getTime());
    // 21:30 UTC on Sep 8 is Sep 9 in Amman — outside.
    const nextAmmanMorning = new Date('2026-09-08T21:30:00.000Z');
    expect(nextAmmanMorning.getTime()).toBeGreaterThanOrEqual(window!.lt!.getTime());
  });

  it('includes Amman early-morning timestamps that fall on the previous UTC date', () => {
    const window = completedDateWindow('2026-09-08', '2026-09-08', tz)!;
    const amman0130 = new Date('2026-09-07T22:30:00.000Z');
    expect(amman0130.getTime()).toBeGreaterThanOrEqual(window.gte!.getTime());
    expect(amman0130.getTime()).toBeLessThan(window.lt!.getTime());
  });

  it('returns null when both bounds are missing or invalid', () => {
    expect(completedDateWindow(undefined, undefined, tz)).toBeNull();
    expect(completedDateWindow('nope', 'also-nope', tz)).toBeNull();
  });
});

describe('completedOnFactoryDaysWhere', () => {
  it('matches actualCompletion or null actualCompletion + updatedAt', () => {
    const window = completedDateWindow('2026-09-08', '2026-09-08', 'Asia/Amman')!;
    const where = completedOnFactoryDaysWhere(window);
    expect(where).toEqual({
      OR: [
        { actualCompletion: { gte: window.gte, lt: window.lt } },
        { AND: [{ actualCompletion: null }, { updatedAt: { gte: window.gte, lt: window.lt } }] },
      ],
    });
  });
});
