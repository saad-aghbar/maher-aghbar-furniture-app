/**
 * Dealer delivery request minimum lead time.
 * Dealers may not request today, tomorrow, day+2, or day+3.
 * Earliest requestable day is factory-local today + 4 calendar days.
 * Independent of capacity, workers, materials, and production earliest.
 * Does not schedule work or change committed dates.
 */

import { addDaysYmd } from './working-calendar';
import { toCommercialYmd } from './commercial-dates';
import type { DealerAvailabilityDay } from './availability-days';

export const DEFAULT_FACTORY_TIMEZONE = 'Asia/Amman';

/** Calendar days after factory-local today before a dealer may request delivery. */
export const DEALER_REQUEST_LEAD_CALENDAR_DAYS = 4;

export const DEALER_DELIVERY_TOO_SOON = 'DELIVERY_DATE_TOO_SOON';

export const DEALER_DELIVERY_TOO_SOON_MESSAGE = {
  en: 'Choose a delivery date at least 4 days from today.',
  ar: 'اختر تاريخ تسليم بعد أربعة أيام على الأقل من اليوم.',
  he: 'בחרו תאריך אספקה לפחות ארבעה ימים מהיום.',
} as const;

export function dealerMinimumRequestYmd(factoryTodayYmd: string): string {
  return addDaysYmd(factoryTodayYmd, DEALER_REQUEST_LEAD_CALENDAR_DAYS);
}

export function isDealerRequestTooSoon(
  requestedYmd: string | null | undefined,
  factoryTodayYmd: string,
): boolean {
  const ymd = toCommercialYmd(requestedYmd);
  if (!ymd) return false;
  return ymd < dealerMinimumRequestYmd(factoryTodayYmd);
}

export function laterYmd(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = toCommercialYmd(a);
  const right = toCommercialYmd(b);
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

export function dealerDeliveryTooSoonMessage(locale?: string | null): string {
  if (locale === 'ar') return DEALER_DELIVERY_TOO_SOON_MESSAGE.ar;
  if (locale === 'he') return DEALER_DELIVERY_TOO_SOON_MESSAGE.he;
  return DEALER_DELIVERY_TOO_SOON_MESSAGE.en;
}

export function dealerDeliveryTooSoonBody(locale?: string | null): {
  code: typeof DEALER_DELIVERY_TOO_SOON;
  message: string;
} {
  return {
    code: DEALER_DELIVERY_TOO_SOON,
    message: dealerDeliveryTooSoonMessage(locale),
  };
}

export function applyDealerLeadTimeToDay(
  day: DealerAvailabilityDay,
  minRequestYmd: string,
): DealerAvailabilityDay {
  if (day.date < minRequestYmd) {
    return {
      date: day.date,
      status: 'unavailable',
      selectable: false,
      reason: 'DEALER_LEAD_TIME',
    };
  }
  return day;
}
