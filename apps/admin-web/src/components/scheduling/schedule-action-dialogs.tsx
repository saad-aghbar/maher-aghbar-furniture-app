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
