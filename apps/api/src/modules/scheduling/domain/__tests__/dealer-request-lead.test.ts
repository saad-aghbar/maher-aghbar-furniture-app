import { ymdInTimezone } from '../factory-replan';
import {
  applyDealerLeadTimeToDay,
  dealerDeliveryTooSoonMessage,
  dealerMinimumRequestYmd,
  DEALER_DELIVERY_TOO_SOON,
  DEALER_DELIVERY_TOO_SOON_MESSAGE,
  isDealerRequestTooSoon,
  laterYmd,
} from '../dealer-request-lead';

describe('dealer request lead time', () => {
  const today = '2026-09-10';

  it('blocks today through day+3 and opens day+4', () => {
    expect(dealerMinimumRequestYmd(today)).toBe('2026-09-14');
    expect(isDealerRequestTooSoon('2026-09-10', today)).toBe(true);
    expect(isDealerRequestTooSoon('2026-09-11', today)).toBe(true);
    expect(isDealerRequestTooSoon('2026-09-12', today)).toBe(true);
    expect(isDealerRequestTooSoon('2026-09-13', today)).toBe(true);
    expect(isDealerRequestTooSoon('2026-09-14', today)).toBe(false);
    expect(isDealerRequestTooSoon('2026-09-18', today)).toBe(false);
  });

  it('still lets factory rules push earliest later than the 4-day floor', () => {
    const min = dealerMinimumRequestYmd(today);
    const factoryEarliest = '2026-09-18';
    expect(laterYmd(min, factoryEarliest)).toBe('2026-09-18');
    expect(isDealerRequestTooSoon('2026-09-14', today)).toBe(false);
  });

  it('uses factory local date, not UTC midnight', () => {
    const utcEvening = new Date('2026-09-09T21:30:00.000Z');
    expect(ymdInTimezone(utcEvening, 'UTC')).toBe('2026-09-09');
    expect(ymdInTimezone(utcEvening, 'Asia/Amman')).toBe('2026-09-10');
    const ammanToday = ymdInTimezone(utcEvening, 'Asia/Amman');
    expect(dealerMinimumRequestYmd(ammanToday)).toBe('2026-09-14');
    expect(isDealerRequestTooSoon('2026-09-13', ammanToday)).toBe(true);
    expect(isDealerRequestTooSoon('2026-09-14', ammanToday)).toBe(false);
  });

  it('marks dealer days before the floor unselectable', () => {
    const blocked = applyDealerLeadTimeToDay(
      { date: '2026-09-13', status: 'available', selectable: true, reason: null },
      '2026-09-14',
    );
    expect(blocked.selectable).toBe(false);
    expect(blocked.status).toBe('unavailable');
    expect(blocked.reason).toBe('DEALER_LEAD_TIME');
    const open = applyDealerLeadTimeToDay(
      { date: '2026-09-14', status: 'available', selectable: true, reason: null },
      '2026-09-14',
    );
    expect(open.selectable).toBe(true);
  });

  it('keeps human copy on the public error without exposing a raw fallback', () => {
    expect(DEALER_DELIVERY_TOO_SOON).toBe('DELIVERY_DATE_TOO_SOON');
    expect(dealerDeliveryTooSoonMessage('en')).toBe(DEALER_DELIVERY_TOO_SOON_MESSAGE.en);
    expect(dealerDeliveryTooSoonMessage('ar')).toBe(DEALER_DELIVERY_TOO_SOON_MESSAGE.ar);
    expect(dealerDeliveryTooSoonMessage('he')).toBe(DEALER_DELIVERY_TOO_SOON_MESSAGE.he);
    expect(dealerDeliveryTooSoonMessage('en')).not.toContain('DELIVERY_DATE_TOO_SOON');
  });
});
