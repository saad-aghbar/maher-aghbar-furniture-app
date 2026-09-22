'use client';

import { anyToYmd, todayYmd, type BoardTone } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

/* ── Row types (subset of the API list rows the Orders section renders) ── */

export interface PartyRef {
  id: string;
  name?: string;
  code?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

export type JourneyBucket = 'preparing' | 'ready_to_start' | 'in_production' | 'ready_to_ship' | 'shipped' | 'delivered';
export const JOURNEY_BUCKETS: JourneyBucket[] = ['preparing', 'ready_to_start', 'in_production', 'ready_to_ship', 'shipped', 'delivered'];

export interface SalesOrderRow {
  id: string;
  number: string;
  status: string;
  total?: string | number | null;
  currency?: string | null;
  projectName?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  requestedDeliveryDate?: string | null;
  requiredDeliveryDate?: string | null;
  externalOrderNumber?: string | null;
  createdAt?: string;
  customer?: PartyRef | null;
  quotation?: { id: string; number: string } | null;
  lineCount?: number;
  progressPercent?: number | null;
  currentStage?: { code: string; nameEn?: string; nameAr?: string | null; nameHe?: string | null } | null;
  journeyBucket?: JourneyBucket | null;
  journeyLogistics?: { committedDeliveryDate?: string | null; truckDepartedAt?: string | null; deliveryId?: string | null; deliveryNumber?: string | null } | null;
  hasReturn?: boolean;
  hasPendingReturn?: boolean;
  manufacturingComplexity?: string | null;
  productionSetupRequired?: boolean;
  deliveryStatus?: string | null;
}

export interface RequestRow {
  id: string;
  number: string;
  status: string;
  source?: string | null;
  requestType?: string | null;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string | null;
  requiredDeliveryDate?: string | null;
  projectName?: string | null;
  title?: string | null;
  customer?: PartyRef | null;
  itemCount?: number;
  items?: unknown[];
  quotation?: { id: string; number: string; status: string } | null;
}

export interface QuotationRow {
  id: string;
  number: string;
  version?: number;
  status: string;
  total?: string | number | null;
  currency?: string | null;
  createdAt?: string;
  expirationDate?: string | null;
  customer?: PartyRef | null;
  request?: { id: string; number: string } | null;
}

export interface DeliveryRow {
  id: string;
  number: string;
  status: string;
  deliveryDate?: string | null;
  scheduledDate?: string | null;
  purpose?: string | null;
  customer?: PartyRef | null;
  salesOrder?: { id: string; number: string } | null;
  warehouse?: { id: string; code?: string; nameEn?: string; nameAr?: string | null } | null;
  addressLine?: string | null;
  city?: string | null;
  packagesLoaded?: number | null;
  packagesTotal?: number | null;
  driverName?: string | null;
}

/* ── Tones ── */

export function salesOrderTone(status: string): BoardTone {
  switch (status) {
    case 'CANCELLED':
      return 'error';
    case 'ON_HOLD':
    case 'WAITING_FOR_MATERIALS':
    case 'WAITING_FOR_PAYMENT':
      return 'warning';
    case 'DELIVERED':
    case 'COMPLETED':
    case 'READY_FOR_DELIVERY':
      return 'success';
    case 'IN_PRODUCTION':
    case 'READY_FOR_PRODUCTION':
      return 'info';
    case 'DRAFT':
      return 'neutral';
    default:
      return 'brand';
  }
}

export function requestTone(status: string): BoardTone {
  switch (status) {
    case 'NEEDS_INFORMATION':
      return 'warning';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'info';
    case 'READY_FOR_QUOTATION':
    case 'QUOTED':
      return 'success';
    case 'CANCELLED':
      return 'error';
    case 'CLOSED':
    case 'DRAFT':
      return 'neutral';
    default:
      return 'brand';
  }
}

export function quotationTone(status: string): BoardTone {
  switch (status) {
    case 'REJECTED':
    case 'CANCELLED':
      return 'error';
    case 'EXPIRED':
      return 'neutral';
    case 'INTERNAL_REVIEW':
    case 'REVISION_REQUESTED':
      return 'warning';
    case 'ACCEPTED':
    case 'APPROVED':
      return 'success';
    case 'SENT':
    case 'VIEWED':
      return 'info';
    case 'DRAFT':
      return 'neutral';
    default:
      return 'brand';
  }
}

export function deliveryTone(status: string): BoardTone {
  switch (status) {
    case 'FAILED':
    case 'CANCELLED':
      return 'error';
    case 'RESCHEDULED':
      return 'warning';
    case 'DELIVERED':
      return 'success';
    case 'OUT_FOR_DELIVERY':
    case 'READY':
      return 'info';
    default:
      return 'brand';
  }
}

export function journeyTone(bucket: JourneyBucket | null | undefined): BoardTone {
  switch (bucket) {
    case 'preparing':
      return 'neutral';
    case 'ready_to_start':
      return 'brand';
    case 'in_production':
      return 'info';
    case 'ready_to_ship':
    case 'shipped':
      return 'warning';
    case 'delivered':
      return 'success';
    default:
      return 'neutral';
  }
}

/** Days until (negative = late) a YYYY-MM-DD / ISO date; null when absent. */
export function daysUntil(date: string | null | undefined, today = todayYmd()): number | null {
  const ymd = anyToYmd(date);
  if (!ymd) return null;
  const a = new Date(`${today}T00:00:00`);
  const b = new Date(`${ymd}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function dueTone(days: number | null, closed = false): BoardTone {
  if (closed || days == null) return 'neutral';
  if (days < 0) return 'error';
  if (days <= 3) return 'warning';
  return 'neutral';
}

const CLOSED_SO = new Set(['DELIVERED', 'COMPLETED', 'CANCELLED']);
export function isClosedSalesOrder(status: string) {
  return CLOSED_SO.has(status);
}

/* ── Copy ── */

export function useOrdersCopy() {
  const locale = useLocale();
  const tm = useTranslations('mobile.orders');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const tq = useTranslations('quotations');
  const tc = useTranslations('catalog');

  return useMemo(() => {
    const money = (value: string | number | null | undefined, currency = 'ILS') => {
      const n = Number(value ?? 0);
      try {
        return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : locale === 'he' ? 'he-IL' : 'en-JO', {
          style: 'currency',
          currency,
          maximumFractionDigits: 2,
          minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        }).format(n);
      } catch {
        return `${n.toFixed(2)} ${currency}`;
      }
    };
    const date = (value: string | null | undefined, opts?: Intl.DateTimeFormatOptions) => {
      if (!value) return '—';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat(locale, opts ?? { day: 'numeric', month: 'short' }).format(d);
    };
    const dateTime = (value: string | null | undefined) => {
      if (!value) return '—';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
    };
    const dueLabel = (days: number | null) => {
      if (days == null) return '';
      if (days === 0) return tSales('desk.dueToday');
      if (days < 0) return tSales('desk.lateBy', { count: Math.abs(days) });
      return tSales('desk.dueIn', { count: days });
    };
    const journey = (b: JourneyBucket | 'all') => tm(`lifecycleShort.${b}` as never);
    const humanize = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    const status = (s: string) => {
      if (!s) return '—';
      try {
        if (typeof tStatus.has === 'function' && !tStatus.has(s as never)) return humanize(s);
        return tStatus(s as never);
      } catch {
        return humanize(s);
      }
    };
    const source = (s: string | null | undefined) => {
      if (!s) return '—';
      const map: Record<string, string> = {
        PORTAL: tq('channelPortal'),
        SALES: tc('sourceSales'),
        WHATSAPP: tq('channelWhatsapp'),
        EMAIL: tq('channelEmail'),
        PDF: tq('channelPdf'),
        PHONE: tq('channelPhone'),
      };
      return map[s] ?? humanize(s);
    };
    return { locale, tm, tSales, tCommon, money, date, dateTime, dueLabel, journey, status, source };
  }, [locale, tm, tSales, tCommon, tStatus, tq, tc]);
}
