'use client';

import { ConfirmDialog as KitConfirmDialog } from '@maher/ui';
import { useTranslations } from 'next-intl';

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
  /** Kept for source compatibility; the kit dialog owns its button shapes. */
  ctaClassName?: string;
}

/** Pre-translated wrapper over the kit `ConfirmDialog` (one question, one primary answer). */
export function ConfirmDialog({ ctaClassName: _ctaClassName, confirmLabel, reasonLabel, ...props }: ConfirmDialogProps) {
  const t = useTranslations('common');
  return (
    <KitConfirmDialog
      {...props}
      confirmLabel={confirmLabel ?? t('confirm')}
      cancelLabel={t('cancel')}
      reasonLabel={reasonLabel ?? t('reason')}
    />
  );
}
