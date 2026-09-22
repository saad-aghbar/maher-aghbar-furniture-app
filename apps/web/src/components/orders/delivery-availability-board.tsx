'use client';

import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import {
  Board,
  CalendarLegend,
  MonthCalendar,
  Stamp,
  anyToYmd,
  cursorFromYmd,
  monthRangeYmd,
  todayYmd,
  type BoardTone,
  type CalendarCursor,
  type DayMeta,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

export interface AvailabilityItem {
  productId: string;
  quantity: number;
  customSpecifications?: string;
}

interface AvailabilityDay {
  date: string;
  status: 'available' | 'unavailable';
  selectable: boolean;
  reason?: string | null;
}

interface AvailabilityAdminDay {
  date: string;
  status: 'available' | 'high_load' | 'closed' | 'unavailable';
  reason: string | null;
  loadPercent?: number;
}

export interface AvailabilityResult {
  estimateStatus: 'UNAVAILABLE' | 'PRELIMINARY' | 'CALCULATED';
  earliestAvailableDate: string | null;
  requestedDateFeasible: boolean;
  suggestedDeliveryDate: string | null;
  alternativeDates: string[];
  estimateConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresAdminEstimateReview: boolean;
  days?: AvailabilityDay[];
  adminDays?: AvailabilityAdminDay[];
  minimumRequestDate?: string | null;
}

/** Factory-local today + 4 calendar days — dealer requests before this are rejected. */
export function localDealerMinimumRequestYmd(now = new Date()): string {
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);
  return anyToYmd(dt);
}

/**
 * Builds MonthCalendar dayMeta from an availability result (port of mobile
 * selectAvailabilityDayMeta). Only "available" days are selectable.
 */
export function availabilityDayMeta(result: AvailabilityResult | undefined, cursor: CalendarCursor, minRequest: string): Record<string, DayMeta> {
  const meta: Record<string, DayMeta> = {};
  const last = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const earliest = anyToYmd(result?.earliestAvailableDate);
  const alternatives = new Set((result?.alternativeDates ?? []).map(anyToYmd));
  const byDate = new Map((result?.days ?? []).map((d) => [anyToYmd(d.date), d]));
  const adminByDate = new Map((result?.adminDays ?? []).map((d) => [anyToYmd(d.date), d]));
  for (let d = 1; d <= last; d++) {
    const ymd = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (ymd < minRequest) {
      meta[ymd] = { tone: 'busy', disabled: true };
      continue;
    }
    const day = byDate.get(ymd);
    const admin = adminByDate.get(ymd);
    if (day) {
      const selectable = day.selectable && day.status === 'available';
      meta[ymd] = {
        tone: selectable ? (ymd === earliest ? 'light' : alternatives.has(ymd) ? 'half' : 'empty') : day.reason === 'CLOSED_DAY' || admin?.status === 'closed' ? 'closed' : 'busy',
        disabled: !selectable,
        isEarliest: Boolean(earliest && ymd === earliest),
        loadPercent: admin?.loadPercent ?? null,
      };
      continue;
    }
    if (admin) {
      meta[ymd] = { tone: admin.status === 'closed' ? 'closed' : admin.status === 'high_load' ? 'busy' : 'empty', disabled: admin.status !== 'available', loadPercent: admin.loadPercent ?? null };
      continue;
    }
    const dow = new Date(cursor.y, cursor.m, d).getDay();
    if (dow === 5) {
      meta[ymd] = { tone: 'closed', disabled: true };
      continue;
    }
    if (earliest && ymd < earliest) {
      meta[ymd] = { tone: 'busy', disabled: true };
      continue;
    }
    if (earliest && ymd === earliest) {
      meta[ymd] = { tone: 'light', isEarliest: true };
      continue;
    }
    if (alternatives.has(ymd)) {
      meta[ymd] = { tone: 'half' };
      continue;
    }
    meta[ymd] = result ? { tone: 'busy', disabled: true } : {};
  }
  return meta;
}

export function useAvailability(items: AvailabilityItem[], cursor: CalendarCursor, opts?: { requestedDeliveryDate?: string; customerId?: string; enabled?: boolean }) {
  const range = monthRangeYmd(cursor);
  const body = useMemo(
    () =>
      items.length
        ? {
            items,
            requestedDeliveryDate: opts?.requestedDeliveryDate || undefined,
            from: range.from,
            to: range.to,
            customerId: opts?.customerId || undefined,
          }
        : null,
    [items, opts?.requestedDeliveryDate, opts?.customerId, range.from, range.to],
  );
  return useQuery({
    queryKey: ['scheduling-availability', body],
    queryFn: () => apiFetch<AvailabilityResult>('/api/v1/scheduling/availability', { method: 'POST', body: JSON.stringify(body) }),
    enabled: Boolean(body) && (opts?.enabled ?? true),
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * DeliveryAvailabilityBoard — the factory calendar for a request/order:
 * requested date, offered date, earliest feasible date, and which days can be
 * promised. Selecting a day hands the YMD to the parent.
 */
export function DeliveryAvailabilityBoard({
  items,
  requestedDate,
  offeredDate,
  selected,
  onSelect,
  customerId,
  title,
  description,
  actions,
  footer,
  tone,
  enabled = true,
}: {
  items: AvailabilityItem[];
  requestedDate?: string | null;
  offeredDate?: string | null;
  selected?: string;
  onSelect: (ymd: string) => void;
  customerId?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  tone?: BoardTone;
  enabled?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('sales');
  const tm = useTranslations('mobile.orders');
  const kit = useKitCopy();
  const requested = anyToYmd(requestedDate);
  const offered = anyToYmd(offeredDate);
  const [cursor, setCursor] = useState<CalendarCursor>(() => cursorFromYmd(selected || offered || requested || todayYmd()));
  const minRequest = localDealerMinimumRequestYmd();
  const availability = useAvailability(items, cursor, { requestedDeliveryDate: requested >= minRequest ? requested : undefined, customerId, enabled });
  const result = availability.data;
  const dayMeta = useMemo(() => {
    const meta = availabilityDayMeta(result, cursor, minRequest);
    if (requested && meta[requested]) meta[requested] = { ...meta[requested], markers: [...(meta[requested].markers ?? []), 'proposed'] };
    if (offered && meta[offered]) meta[offered] = { ...meta[offered], markers: [...(meta[offered].markers ?? []), 'confirmed'] };
    return meta;
  }, [result, cursor, minRequest, requested, offered]);

  const earliest = anyToYmd(result?.earliestAvailableDate);
  const feasible = result?.requestedDateFeasible;
  const resolvedTone: BoardTone = tone ?? (result ? (feasible ? 'success' : 'warning') : 'neutral');

  return (
    <Board tone={resolvedTone}>
      <Board.Header
        title={title}
        description={description}
        actions={actions}
        meta={
          result ? (
            <Stamp tone={feasible ? 'success' : 'warning'} size="sm">
              {feasible ? t('desk.requestedFeasible') : t('desk.requestedNotFeasible')}
            </Stamp>
          ) : availability.isLoading && items.length ? (
            <span>{kit.combobox.loading}</span>
          ) : null
        }
      />
      <Board.Body className="space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[var(--maher-text-secondary)]">
          {requested ? (
            <span>
              {t('dealerDeliveryDate')}: <span className="font-medium text-[var(--maher-text-primary)]" dir="ltr">{requested}</span>
            </span>
          ) : null}
          {offered ? (
            <span>
              {t('desk.offeredDate')}: <span className="font-medium text-[var(--maher-text-primary)]" dir="ltr">{offered}</span>
            </span>
          ) : null}
          {earliest ? (
            <button type="button" className="maher-press text-[var(--maher-brand)] hover:underline" onClick={() => onSelect(earliest)}>
              {tm('earliestAvailable')}: <span dir="ltr">{earliest}</span>
            </button>
          ) : null}
        </div>
        <MonthCalendar
          value={selected ?? ''}
          onSelect={onSelect}
          monthCursor={cursor}
          onMonthChange={setCursor}
          dayMeta={dayMeta}
          disableUnavailable={Boolean(result)}
          minDate={minRequest}
          variant="dealer"
          embedded
          locale={locale}
          prevLabel={kit.date.prevMonth}
          nextLabel={kit.date.nextMonth}
        />
        <CalendarLegend
          items={[
            { id: 'earliest', label: tm('earliestAvailable'), swatch: 'light' },
            { id: 'alt', label: t('desk.alsoAvailable'), swatch: 'half' },
            { id: 'busy', label: t('desk.fullyBooked'), swatch: 'busy' },
            { id: 'closed', label: t('desk.closedDay'), swatch: 'closed' },
            { id: 'requested', label: t('dealerDeliveryDate'), swatch: 'proposed' },
            ...(offered ? [{ id: 'offered', label: t('desk.offeredDate'), swatch: 'confirmed' as const }] : []),
          ]}
        />
      </Board.Body>
      {footer ? <Board.Footer>{footer}</Board.Footer> : null}
    </Board>
  );
}
