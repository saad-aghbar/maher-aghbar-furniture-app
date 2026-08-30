'use client';

import { Alert, Button, Input, Modal } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  error?: string | null;
  /** When set, shows a reason field passed to onConfirm. */
  withReason?: boolean;
  /** When set with withReason, confirm stays disabled until reason is non-empty. */
  reasonRequired?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  loading,
  error,
  withReason,
  reasonRequired,
  reasonLabel,
  reasonPlaceholder,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const t = useTranslations('common');
  const [reason, setReason] = useState('');
  const trimmedReason = reason.trim();
  const reasonMissing = Boolean(withReason && reasonRequired && !trimmedReason);

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            disabled={reasonMissing}
            onClick={() => onConfirm(withReason ? trimmedReason || undefined : undefined)}
          >
            {confirmLabel ?? t('confirm')}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--maher-text-secondary)]">{description}</p>
      {withReason ? (
        <Input
          className="mt-3"
          label={reasonLabel ?? t('reason')}
          placeholder={reasonPlaceholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      ) : null}
      {error ? (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      ) : null}
    </Modal>
  );
}
