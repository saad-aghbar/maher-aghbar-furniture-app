'use client';

import { Link } from '@/i18n/navigation';
import {
  formatYmdLabel,
  selectAvailableActions,
  type AdminScheduleActionMode,
  type AdminScheduleCardModel,
} from '@/lib/scheduling-board';
import { Badge, Button, cn, Ltr, StatusBadge } from '@maher/ui';
import { Armchair, CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

export function ScheduleOrderRow({
  card,
  onAction,
}: {
  card: AdminScheduleCardModel;
  onAction: (mode: AdminScheduleActionMode, card: AdminScheduleCardModel) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('mobile.adminScheduling');
  const tProd = useTranslations('mobile.production');
  const tCommon = useTranslations('common');

  const reasonCopy = humanAtRiskReason(t, card.reason);

  const priority = (card.priority ?? '').toUpperCase();
  const urgent = priority === 'URGENT' || priority === 'HIGH';
  const alerted = card.hasConflict || card.materialRisk;
  const accent = card.hasConflict || card.materialRisk
    ? 'bg-[var(--maher-error)]'
    : urgent
      ? 'bg-[var(--maher-warning)]'
      : 'bg-brand';
  const productTitle = card.title !== card.number ? card.title : card.number;
  const startLabel = card.plannedStart ? formatYmdLabel(card.plannedStart, locale) : null;
  const endLabel = card.plannedEnd ? formatYmdLabel(card.plannedEnd, locale) : null;
  const plannedLabel =
    startLabel && endLabel && endLabel !== startLabel
      ? t('plannedWindow', { start: startLabel, end: endLabel })
      : startLabel
        ? t('plannedFor', { date: startLabel })
        : null;
  const requiredLabel = card.requiredDeliveryDate
    ? t('requiredBy', { date: formatYmdLabel(card.requiredDeliveryDate, locale) })
    : null;
  const suggestedLabel =
    !plannedLabel && card.suggestedDeliveryDate
      ? t('suggestedBy', { date: formatYmdLabel(card.suggestedDeliveryDate, locale) })
      : null;
  const actions = selectAvailableActions(card);
  const priorityKey = `priority.${priority}`;
  const priorityText = card.priority
    ? tProd.has(priorityKey)
      ? tProd(priorityKey)
      : card.priority
    : null;

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border bg-surface shadow-[var(--maher-shadow-sm)]',
        alerted
          ? 'border-[var(--maher-error)]/50'
          : urgent
            ? 'border-[var(--maher-warning)]/50'
            : 'border-border',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 start-0 w-[3px]',
          accent,
          alerted || urgent ? 'opacity-100' : 'opacity-50',
        )}
      />
      <div className="flex gap-3 p-3 ps-4">
        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-[var(--maher-surface-muted)]">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-tertiary">
              <Armchair className="h-6 w-6 opacity-40" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">{productTitle}</p>
            {card.status ? <StatusBadge status={card.status} /> : null}
          </div>
          <Ltr className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            {card.number}
          </Ltr>
          {card.dealerName ? (
            <p className="truncate text-xs text-text-secondary">{card.dealerName}</p>
          ) : null}
          {plannedLabel ? <p className="text-xs text-text-secondary">{plannedLabel}</p> : null}
          {requiredLabel ? <p className="text-xs text-text-tertiary">{requiredLabel}</p> : null}
          {suggestedLabel ? <p className="text-xs text-text-tertiary">{suggestedLabel}</p> : null}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {card.quantity != null ? (
              <span className="text-[11px] text-text-tertiary">{t('qty', { count: card.quantity })}</span>
            ) : null}
            {priorityText && urgent ? (
              <Badge variant="warning" className="scale-90 px-1.5 py-0">
                {priorityText}
              </Badge>
            ) : card.priority && !urgent ? (
              <StatusBadge status={card.priority} />
            ) : null}
            {card.hasConflict ? (
              <Badge variant="error" className="scale-90 px-1.5 py-0">
                {t('conflict')}
              </Badge>
            ) : null}
            {card.materialRisk ? (
              <Badge variant="error" className="scale-90 px-1.5 py-0">
                {t('materialRisk')}
              </Badge>
            ) : null}
          </div>
          {reasonCopy ? <p className="text-xs text-[var(--maher-error)]">{reasonCopy}</p> : null}
          <div className="flex flex-wrap items-center gap-2 pt-1.5">
            <Link
              href={`/production/${card.productionOrderId}`}
              className="text-xs font-semibold text-brand hover:underline"
            >
              {tCommon('details')}
            </Link>
            {actions.includes('approve') ? (
              <Button
                size="sm"
                variant="subtle"
                leadingIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                onClick={() => onAction('approve', card)}
              >
                {t('sheets.approveConfirm')}
              </Button>
            ) : null}
            {actions.includes('changeDate') ? (
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<CalendarClock className="h-3.5 w-3.5" />}
                onClick={() => onAction('changeDate', card)}
              >
                {t('sheets.changeDateTitle')}
              </Button>
            ) : null}
            {actions.includes('recalculate') ? (
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={() => onAction('recalculate', card)}
              >
                {t('sheets.recalculateConfirm')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function humanAtRiskReason(
  t: (key: string) => string,
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  if (/^(demo|async|debug|seed):/i.test(raw.trim())) return null;
  const key = raw.replace(/^mobile\.adminScheduling\./, '');
  if (key.includes('.')) {
    const translated = t(key);
    if (translated && translated !== key && translated !== raw) return translated;
  }
  if (/^[A-Z0-9_]+$/.test(raw)) return null;
  return raw;
}
