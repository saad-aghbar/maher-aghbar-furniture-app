'use client';

import { Link } from '@/i18n/navigation';
import {
  formatYmdLabel,
  selectAvailableActions,
  type AdminScheduleActionMode,
  type AdminScheduleCardModel,
} from '@/lib/scheduling-board';
import { Button, Ltr, Menu, RowThumb, Stamp, type BoardTone } from '@maher/ui';
import { Armchair, CalendarClock, CheckCircle2, MoreHorizontal, RefreshCw } from 'lucide-react';
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
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');

  const reasonCopy = humanAtRiskReason(t, card.reason);
  const priority = (card.priority ?? '').toUpperCase();
  const urgent = priority === 'URGENT' || priority === 'HIGH';
  const alerted = card.hasConflict || card.materialRisk;
  const tone: BoardTone = alerted ? 'error' : urgent ? 'warning' : card.status === 'APPROVED' || card.status === 'COMMITTED' ? 'success' : 'brand';
  const productTitle = card.title !== card.number ? card.title : card.number;
  const startLabel = card.plannedStart ? formatYmdLabel(card.plannedStart, locale) : null;
  const endLabel = card.plannedEnd ? formatYmdLabel(card.plannedEnd, locale) : null;
  const plannedLabel = startLabel && endLabel && endLabel !== startLabel ? t('plannedWindow', { start: startLabel, end: endLabel }) : startLabel ? t('plannedFor', { date: startLabel }) : null;
  const requiredLabel = card.requiredDeliveryDate ? t('requiredBy', { date: formatYmdLabel(card.requiredDeliveryDate, locale) }) : null;
  const suggestedLabel = !plannedLabel && card.suggestedDeliveryDate ? t('suggestedBy', { date: formatYmdLabel(card.suggestedDeliveryDate, locale) }) : null;
  const actions = selectAvailableActions(card);
  const priorityKey = `priority.${priority}`;
  const priorityText = card.priority ? (tProd.has(priorityKey) ? tProd(priorityKey) : card.priority) : null;
  const statusText = card.status ? (tStatus.has(card.status) ? tStatus(card.status as never) : card.status.replace(/_/g, ' ')) : null;

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <RowThumb src={card.imageUrl} icon={<Armchair className="h-4 w-4" />} className="mt-0.5 h-11 w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/admin/production/${card.productionOrderId}`} className="truncate text-[14px] font-semibold text-[var(--maher-text-primary)] hover:text-[var(--maher-brand)]">
            {productTitle}
          </Link>
          {statusText ? (
            <Stamp tone={tone} size="sm">
              {statusText}
            </Stamp>
          ) : null}
          {card.hasConflict ? <Stamp tone="error" size="sm">{t('conflict')}</Stamp> : null}
          {card.materialRisk ? <Stamp tone="error" size="sm">{t('materialRisk')}</Stamp> : null}
          {priorityText && urgent ? <Stamp tone="warning" size="sm">{priorityText}</Stamp> : null}
        </div>
        <p className="truncate text-[12px] text-[var(--maher-text-tertiary)]">
          <Ltr>{card.number}</Ltr>
          {card.dealerName ? ` · ${card.dealerName}` : ''}
          {card.quantity != null ? ` · ${t('qty', { count: card.quantity })}` : ''}
        </p>
        <p className="text-[12px] text-[var(--maher-text-secondary)]">{[plannedLabel, requiredLabel, suggestedLabel].filter(Boolean).join(' · ')}</p>
        {reasonCopy ? <p className="mt-0.5 text-[12px] text-[var(--maher-error)]">{reasonCopy}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {actions.includes('approve') ? (
          <Button size="sm" leadingIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => onAction('approve', card)}>
            {t('sheets.approveConfirm')}
          </Button>
        ) : null}
        <Menu
          aria-label={tCommon('actions')}
          trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>}
          items={[
            { id: 'open', label: tCommon('details'), href: `/admin/production/${card.productionOrderId}` },
            { id: 'date', label: t('sheets.changeDateTitle'), icon: <CalendarClock className="h-4 w-4" />, onSelect: () => onAction('changeDate', card) },
            { id: 'recalc', label: t('sheets.recalculateConfirm'), icon: <RefreshCw className="h-4 w-4" />, onSelect: () => onAction('recalculate', card) },
          ]}
          LinkComponent={Link}
        />
      </div>
    </li>
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
