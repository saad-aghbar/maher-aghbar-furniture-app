'use client';

import type { DayStripColumn } from '@maher/ui';
import type { MgmtDayPoint, MgmtTile } from '@/lib/management-summary';
import { tileLink } from '@/lib/management-summary';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

export function money(value: number | undefined, currency: string): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toLocaleString('en-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function compactMoney(value: number | undefined, currency: string): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `0 ${currency}`;
  return `${n.toLocaleString('en-JO', { maximumFractionDigits: 0 })} ${currency}`;
}

/** `YYYY-MM-DD` (server local day key) → local Date at midnight. */
export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map((x) => Number(x));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Shared copy helpers for desk boards. */
export function useDeskCopy() {
  const t = useTranslations('common');
  const locale = useLocale();
  const currency = t('currency');

  const tileLabel = useCallback(
    (key: string, fallback?: string): string => {
      const i18nKey = `mgmtTile_${key}`;
      try {
        const label = t(i18nKey as never);
        if (label && label !== i18nKey) return label;
      } catch {
        /* missing key */
      }
      if (fallback) return fallback;
      return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    },
    [t],
  );

  const weekday = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );
  const clock = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale],
  );
  const longDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
    [locale],
  );

  const dayColumns = useCallback(
    (
      points: MgmtDayPoint[] | undefined,
      opts?: { compare?: MgmtDayPoint[]; href?: string },
    ): DayStripColumn[] => {
      if (!points?.length) return [];
      const todayKey = localDayKey(new Date());
      return points.map((p, i) => ({
        key: p.date,
        label: weekday.format(dayKeyToDate(p.date)),
        value: p.count,
        compare: opts?.compare?.[i]?.count,
        today: p.date === todayKey,
        href: opts?.href,
      }));
    },
    [weekday],
  );

  const tileHref = useCallback((tile: MgmtTile) => tileLink(tile.href, tile.filter), []);

  return {
    t,
    locale,
    currency,
    tileLabel,
    tileHref,
    dayColumns,
    time: (iso: string) => clock.format(new Date(iso)),
    date: (d: Date) => longDate.format(d),
    money: (v: number | undefined) => money(v, currency),
    compactMoney: (v: number | undefined) => compactMoney(v, currency),
  };
}
