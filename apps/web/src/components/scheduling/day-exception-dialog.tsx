'use client';

import { apiFetch } from '@/lib/api-client';
import { Alert, Button, Figure, Input, SegmentedControl, Sheet, Stamp, type BoardTone } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export type DayExceptionKind = 'open' | 'close' | 'overtime' | 'clear';

type Impact = { date: string; taskCount: number; orderCount: number; workerCount: number; committedDeliveryCount: number };

/**
 * Day capacity sheet — open / close / overtime / clear for one factory day, with the
 * mobile-only impact preview (assignments touched) shown before anything is written.
 */
export function DayExceptionDialog({
  open,
  onClose,
  dateYmd,
  isWorking,
  hasException,
  defaultShiftStart = '08:00',
  defaultShiftEnd = '16:00',
  loading,
  errorMessage,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  dateYmd: string;
  isWorking: boolean;
  hasException: boolean;
  defaultShiftStart?: string;
  defaultShiftEnd?: string;
  loading?: boolean;
  errorMessage?: string | null;
  onAction: (kind: DayExceptionKind, overtimeEnd?: string) => void;
}) {
  const t = useTranslations('mobile.adminScheduling.dayCapacity');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [kind, setKind] = useState<DayExceptionKind>(isWorking ? 'overtime' : 'open');
  const [overtimeEnd, setOvertimeEnd] = useState('20:00');
  useEffect(() => {
    if (open) setKind(isWorking ? 'overtime' : 'open');
  }, [open, isWorking]);

  const impact = useQuery({
    queryKey: ['scheduling-day-impact', dateYmd],
    queryFn: () => apiFetch<Impact>(`/api/v1/scheduling/calendar-settings/exceptions/${encodeURIComponent(dateYmd)}/impact`),
    enabled: open,
    staleTime: 30_000,
  });
  const label = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${dateYmd}T00:00:00`));
  const options = isWorking
    ? [
        { value: 'overtime', label: t('addOvertime') },
        { value: 'close', label: t('close') },
      ]
    : [{ value: 'open', label: t('open') }];
  if (hasException) options.push({ value: 'clear', label: t('clear') });
  const tone: BoardTone = kind === 'close' ? 'error' : kind === 'overtime' ? 'warning' : kind === 'open' ? 'success' : 'neutral';
  const touched = impact.data?.taskCount ?? 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('title', { date: label })}
      description={t('body')}
      tone={tone}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {tCommon('cancel')}
          </Button>
          <Button variant={kind === 'close' ? 'danger' : 'primary'} loading={loading} onClick={() => onAction(kind, kind === 'overtime' ? overtimeEnd : undefined)}>
            {options.find((o) => o.value === kind)?.label ?? tCommon('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Stamp tone={isWorking ? 'success' : 'neutral'}>{isWorking ? t('statusOpen') : t('statusClosed')}</Stamp>
          <span className="text-[13px] text-[var(--maher-text-secondary)]" dir="ltr">
            {t('normalShift', { range: `${defaultShiftStart} – ${defaultShiftEnd}` })}
          </span>
        </div>
        <SegmentedControl aria-label={t('title', { date: label })} value={kind} onChange={(v) => setKind(v as DayExceptionKind)} options={options} />
        {kind === 'overtime' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('overtimeUntil')} type="time" value={overtimeEnd} onChange={(e) => setOvertimeEnd(e.target.value)} dir="ltr" />
            <div className="flex items-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOvertimeEnd((v) => shift(v, -60, defaultShiftEnd))}>
                {t('overtimeEarlier')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setOvertimeEnd((v) => shift(v, 60, defaultShiftEnd))}>
                {t('overtimeLater')}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="rounded-[12px] border border-[var(--maher-border)] p-4">
          <div className="grid grid-cols-3 gap-3">
            <Figure size="sm" value={impact.data?.taskCount ?? 0} label={t('impactTasks')} tone={touched ? (kind === 'close' ? 'error' : 'warning') : 'success'} />
            <Figure size="sm" value={impact.data?.orderCount ?? 0} label={t('impactOrders')} tone="neutral" />
            <Figure size="sm" value={impact.data?.workerCount ?? 0} label={t('workers')} tone="neutral" />
          </div>
          <p className="mt-2 text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{t('impact', { tasks: impact.data?.taskCount ?? 0, orders: impact.data?.orderCount ?? 0 })}</p>
          {impact.data?.committedDeliveryCount ? <p className="mt-1 text-[12px] text-[var(--maher-warning)]">{t('impactCommitted', { count: impact.data.committedDeliveryCount })}</p> : null}
        </div>
        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
      </div>
    </Sheet>
  );
}

function shift(hhmm: string, deltaMinutes: number, floor: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const [fh, fm] = floor.split(':').map(Number);
  const total = Math.max((fh ?? 16) * 60 + (fm ?? 0) + 30, Math.min(23 * 60 + 30, (h ?? 20) * 60 + (m ?? 0) + deltaMinutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
