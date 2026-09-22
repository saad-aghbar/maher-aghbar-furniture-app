'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Alert } from '../Alert';
import { Button } from '../Button';
import { Input } from '../Input';
import { Modal } from '../Modal';
import { Stamp } from '../board/Stamp';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Sienna confirm button + error stamp. */
  danger?: boolean;
  loading?: boolean;
  error?: string | null;
  /** Shows a reason field passed to `onConfirm`. */
  withReason?: boolean;
  /** With `withReason`, confirm stays disabled until the reason is non-empty. */
  reasonRequired?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
  /** Extra content between the description and the reason field. */
  children?: ReactNode;
}

/** One question, one primary answer. Never stacks; never asks twice. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  loading,
  error,
  withReason,
  reasonRequired,
  reasonLabel = 'Reason',
  reasonPlaceholder,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const reasonMissing = Boolean(withReason && reasonRequired && !trimmed);

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
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            disabled={reasonMissing}
            onClick={() => onConfirm(withReason ? trimmed || undefined : undefined)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <Stamp tone={danger ? 'error' : 'warning'} className="mt-[7px]" />
        <p className="text-sm leading-relaxed text-[var(--maher-text-secondary)]">{description}</p>
      </div>
      {children}
      {withReason ? (
        <div className="mt-3">
          <Input
            label={reasonLabel}
            placeholder={reasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      ) : null}
      {error ? (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      ) : null}
    </Modal>
  );
}
