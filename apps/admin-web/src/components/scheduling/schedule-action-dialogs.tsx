'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import type { AdminScheduleCardModel } from '@/lib/scheduling-board';
import { Alert, Button, Input, Modal, TextArea } from '@maher/ui';
import { useTranslations } from 'next-intl';
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

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t('approveTitle')}
      description={t('approveBody', { number: card?.number ?? '' })}
      confirmLabel={t('approveConfirm')}
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

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t('recalculateTitle')}
      description={t('recalculateBody', { number: card?.number ?? '' })}
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
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setDate((card?.plannedStart ?? card?.requiredDeliveryDate ?? '').slice(0, 10));
      setReason('');
    }
  }, [open, card]);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('changeDateTitle')}
      description={tp('changeDateHint')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {tCommon('cancel')}
          </Button>
          <Button
            loading={loading}
            disabled={!valid}
            onClick={() => onSubmit(date, reason.trim() || undefined)}
          >
            {t('saveDate')}
          </Button>
        </>
      }
    >
      <Input
        type="date"
        label={tp('newPreferredDate')}
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <TextArea
        className="mt-3"
        label={t('reasonLabel')}
        placeholder={t('reasonPlaceholder')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
      />
      {error ? (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      ) : null}
    </Modal>
  );
}

export type SyncDialogPhase =
  | 'confirm'
  | 'syncing'
  | 'upToDate'
  | 'changed'
  | 'partial'
  | 'failed'
  | 'inProgress';

export type SyncDialogStats = {
  scanned: number;
  alreadyValid: number;
  generated: number;
  replanned: number;
  pastDueRescheduled?: number;
  atRiskRecovered: number;
  stillAttention: number;
  conflictsResolved: number;
};

export function SyncScheduleDialog({
  open,
  phase,
  stats,
  error,
  onClose,
  onConfirm,
  onRetry,
}: {
  open: boolean;
  phase: SyncDialogPhase;
  stats?: SyncDialogStats | null;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onRetry?: () => void;
}) {
  const t = useTranslations('mobile.adminScheduling.sync');
  const tCommon = useTranslations('common');
  const title =
    phase === 'syncing'
      ? t('syncing')
      : phase === 'upToDate'
        ? t('upToDate')
        : phase === 'changed'
          ? t('complete')
          : phase === 'partial'
            ? t('partial')
            : phase === 'failed'
              ? t('failed')
              : phase === 'inProgress'
                ? t('inProgress')
                : t('confirmTitle');
  const result = phase === 'upToDate' || phase === 'changed' || phase === 'partial' || phase === 'failed';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        phase === 'syncing' ? undefined : result ? (
          <>
            {phase === 'failed' && onRetry ? (
              <Button variant="ghost" onClick={onRetry}>
                {t('retry')}
              </Button>
            ) : null}
            <Button onClick={onClose}>{t('done')}</Button>
          </>
        ) : phase === 'inProgress' ? (
          <Button onClick={onClose}>{t('done')}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={onConfirm}>{t('confirmCta')}</Button>
          </>
        )
      }
    >
      {phase === 'syncing' ? (
        <p className="text-sm text-[var(--maher-text-secondary)]">{t('syncing')}</p>
      ) : phase === 'inProgress' ? (
        <p className="text-sm text-[var(--maher-text-secondary)]">{t('inProgress')}</p>
      ) : phase === 'upToDate' ? (
        <p className="text-sm text-[var(--maher-text-secondary)]">{t('upToDateBody')}</p>
      ) : phase === 'failed' ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--maher-text-secondary)]">{t('failedBody')}</p>
          {error ? <Alert variant="error">{error}</Alert> : null}
        </div>
      ) : phase === 'changed' || phase === 'partial' ? (
        <div className="space-y-3">
          {phase === 'partial' ? (
            <p className="text-sm text-[var(--maher-text-secondary)]">{t('partial')}</p>
          ) : (
            <p className="text-sm text-[var(--maher-text-secondary)]">{t('complete')}</p>
          )}
          {stats ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-[var(--maher-text-tertiary)]">{t('replanned')}</dt>
                <dd className="font-semibold tabular-nums">{stats.replanned}</dd>
              </div>
              <div>
                <dt className="text-[var(--maher-text-tertiary)]">{t('generated')}</dt>
                <dd className="font-semibold tabular-nums">{stats.generated}</dd>
              </div>
              {stats.pastDueRescheduled ? (
                <div>
                  <dt className="text-[var(--maher-text-tertiary)]">{t('pastDueRescheduled')}</dt>
                  <dd className="font-semibold tabular-nums">{stats.pastDueRescheduled}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[var(--maher-text-tertiary)]">{t('scanned')}</dt>
                <dd className="font-semibold tabular-nums">{stats.scanned}</dd>
              </div>
              <div>
                <dt className="text-[var(--maher-text-tertiary)]">
                  {phase === 'partial' ? t('stillAttention') : t('alreadyValid')}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {phase === 'partial' ? stats.stillAttention : stats.alreadyValid}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-[var(--maher-text-secondary)]">{t('confirmBody')}</p>
      )}
    </Modal>
  );
}

export type OptimizeDialogPhase =
  | 'confirm'
  | 'previewing'
  | 'preview'
  | 'applying'
  | 'upToDate'
  | 'changed'
  | 'partial'
  | 'failed'
  | 'inProgress';

export type OptimizeDialogStats = {
  scanned: number;
  wouldMove: number;
  moved: number;
  stillAttention: number;
  emptyDays: Array<{ ymd: string; causeKey: string }>;
};

export function OptimizeScheduleDialog({
  open,
  phase,
  stats,
  error,
  onClose,
  onConfirm,
  onApply,
  onRetry,
}: {
  open: boolean;
  phase: OptimizeDialogPhase;
  stats?: OptimizeDialogStats | null;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onApply?: () => void;
  onRetry?: () => void;
}) {
  const t = useTranslations('mobile.adminScheduling.optimize');
  const tRoot = useTranslations();
  const tCommon = useTranslations('common');
  const title =
    phase === 'previewing'
      ? t('previewing')
      : phase === 'preview'
        ? t('previewTitle')
        : phase === 'applying'
          ? t('applying')
          : phase === 'upToDate'
            ? t('upToDate')
            : phase === 'changed'
              ? t('complete')
              : phase === 'partial'
                ? t('partial')
                : phase === 'failed'
                  ? t('failed')
                  : phase === 'inProgress'
                    ? t('inProgress')
                    : t('confirmTitle');
  const result = phase === 'upToDate' || phase === 'changed' || phase === 'partial' || phase === 'failed';
  const busy = phase === 'previewing' || phase === 'applying';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        busy ? undefined : result ? (
          <>
            {phase === 'failed' && onRetry ? (
              <Button variant="ghost" onClick={onRetry}>
                {t('retry')}
              </Button>
            ) : null}
            <Button onClick={onClose}>{t('done')}</Button>
          </>
        ) : phase === 'preview' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('done')}
            </Button>
            <Button onClick={onApply}>{t('applyCta')}</Button>
          </>
        ) : phase === 'inProgress' ? (
          <Button onClick={onClose}>{t('done')}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={onConfirm}>{t('confirmCta')}</Button>
          </>
        )
      }
    >
      {busy ? (
        <p className="text-sm text-[var(--maher-text-secondary)]">
          {phase === 'applying' ? t('applying') : t('previewing')}
        </p>
      ) : phase === 'inProgress' ? (
        <p className="text-sm text-[var(--maher-text-secondary)]">{t('inProgress')}</p>
      ) : phase === 'upToDate' ? (
        <p className="text-sm text-[var(--maher-text-secondary)]">{t('upToDateBody')}</p>
      ) : phase === 'failed' ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--maher-text-secondary)]">{t('failedBody')}</p>
          {error ? <Alert variant="error">{error}</Alert> : null}
        </div>
      ) : phase === 'preview' ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--maher-text-secondary)]">{t('previewBody')}</p>
          {stats ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-[var(--maher-text-tertiary)]">{t('wouldMove')}</dt>
                <dd className="font-semibold tabular-nums">{stats.wouldMove}</dd>
              </div>
              <div>
                <dt className="text-[var(--maher-text-tertiary)]">{t('scanned')}</dt>
                <dd className="font-semibold tabular-nums">{stats.scanned}</dd>
              </div>
            </dl>
          ) : null}
          {stats?.emptyDays.slice(0, 4).map((day) => (
            <p key={day.ymd} className="text-xs text-[var(--maher-text-secondary)]">
              {day.ymd} · {tRoot(day.causeKey)}
            </p>
          ))}
        </div>
      ) : phase === 'changed' || phase === 'partial' ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--maher-text-secondary)]">
            {phase === 'partial' ? t('partial') : t('complete')}
          </p>
          {stats ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-[var(--maher-text-tertiary)]">{t('moved')}</dt>
                <dd className="font-semibold tabular-nums">{stats.moved}</dd>
              </div>
              <div>
                <dt className="text-[var(--maher-text-tertiary)]">{t('scanned')}</dt>
                <dd className="font-semibold tabular-nums">{stats.scanned}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-[var(--maher-text-secondary)]">{t('confirmBody')}</p>
      )}
    </Modal>
  );
}
