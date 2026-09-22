'use client';

import { useKitCopy } from '@/lib/kit-copy';
import type { AdminScheduleCardModel } from '@/lib/scheduling-board';
import { Alert, Button, ConfirmDialog, DateField, KeyFacts, Sheet, TextArea, todayYmd } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function ApproveScheduleDialog({
  open,
  card,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  card: AdminScheduleCardModel | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('mobile.adminScheduling.sheets');
  const tCommon = useTranslations('common');

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t('approveTitle')}
      description={t('approveBody', { number: card?.number ?? '' })}
      confirmLabel={t('approveConfirm')}
      cancelLabel={tCommon('cancel')}
      loading={loading}
      error={error}
      onConfirm={onConfirm}
    />
  );
}

export function RecalculateScheduleDialog({
  open,
  card,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  card: AdminScheduleCardModel | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const t = useTranslations('mobile.adminScheduling.sheets');
  const tCommon = useTranslations('common');

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t('recalculateTitle')}
      description={t('recalculateBody', { number: card?.number ?? '' })}
      cancelLabel={tCommon('cancel')}
      confirmLabel={t('recalculateConfirm')}
      loading={loading}
      error={error}
      withReason
      reasonLabel={t('reasonLabel')}
      reasonPlaceholder={t('reasonPlaceholder')}
      onConfirm={onConfirm}
    />
  );
}

export function ChangeDateDialog({
  open,
  card,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  card: AdminScheduleCardModel | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (isoDate: string, reason?: string) => void;
}) {
  const t = useTranslations('mobile.adminScheduling.sheets');
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const kit = useKitCopy();
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setDate((card?.requiredDeliveryDate ?? card?.plannedEnd ?? card?.plannedStart ?? '').slice(0, 10));
      setReason('');
    }
  }, [open, card]);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const fmt = (v?: string | null) => (v ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v)) : '—');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('changeDateTitle')}
      description={card ? `${card.number} · ${card.title}` : tp('changeDateHint')}
      tone="info"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {tCommon('cancel')}
          </Button>
          <Button loading={loading} disabled={!valid} onClick={() => onSubmit(date, reason.trim() || undefined)}>
            {t('saveDate')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {card ? (
          <KeyFacts
            columns={2}
            facts={[
              { label: tp('requestedDate'), value: fmt(card.requiredDeliveryDate), ltr: true },
              { label: tp('suggestedDate'), value: fmt(card.suggestedDeliveryDate), ltr: true },
            ]}
          />
        ) : null}
        <DateField label={tp('newPreferredDate')} value={date} onChange={setDate} copy={kit.date} locale={locale} minDate={todayYmd()} todayShortcut presentation="popover" />
        <p className="text-[12px] text-[var(--maher-text-tertiary)]">{tp('changeDateHint')}</p>
        <TextArea label={t('reasonLabel')} placeholder={t('reasonPlaceholder')} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        {error ? <Alert variant="error">{error}</Alert> : null}
      </div>
    </Sheet>
  );
}
