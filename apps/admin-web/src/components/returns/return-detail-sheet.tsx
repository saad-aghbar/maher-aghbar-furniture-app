'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Ltr,
  Modal,
  StatusBadge,
  TextArea,
  cn,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Armchair, ImageOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { ReturnRow } from './return-types';

function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url}`;
}

type ConfirmAction =
  | { kind: 'approve' }
  | { kind: 'reject' }
  | { kind: 'need_info' }
  | { kind: 'receive' }
  | { kind: 'fate'; fate: 'RETURN_TO_STOCK' | 'REWORK' | 'DAMAGED' | 'SCRAP' };

type Props = {
  open: boolean;
  row: ReturnRow | null;
  onClose: () => void;
};

export function ReturnDetailSheet({ open, row, onClose }: Props) {
  const locale = useLocale();
  const t = useTranslations('lifecycle');
  const tc = useTranslations('catalog');
  const ti = useTranslations('inventory');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [needInfoNote, setNeedInfoNote] = useState('');
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setNeedInfoNote('');
      setConfirm(null);
    }
  }, [open]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['returns'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const resolveMutation = useMutation({
    mutationFn: (approvalStatus: 'APPROVED' | 'REJECTED') =>
      apiFetch(`/api/v1/returns/${row!.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus }),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
      onClose();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const needInfoMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${row!.id}/need-info`, {
        method: 'PATCH',
        body: JSON.stringify({ needInfoNote: needInfoNote.trim() }),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
      onClose();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const receiveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${row!.id}/receive`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const fateMutation = useMutation({
    mutationFn: (inventoryFate: 'RETURN_TO_STOCK' | 'REWORK' | 'DAMAGED' | 'SCRAP') =>
      apiFetch(`/api/v1/returns/${row!.id}/inventory-fate`, {
        method: 'PATCH',
        body: JSON.stringify({ inventoryFate }),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
      onClose();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (!row) return null;

  const approval = (row.approvalStatus ?? 'PENDING').toUpperCase();
  const physical = (row.physicalStatus ?? 'NONE').toUpperCase();
  const pending = approval === 'PENDING' || approval === 'NEED_INFO';
  const canReceive = approval === 'APPROVED' && physical === 'WAITING_RETURN';
  const canFate =
    physical === 'RETURNED' || physical === 'INSPECTING'
      ? !row.inventoryFate || row.inventoryFate === 'PENDING'
      : false;
  const customerLabel = row.customer
    ? localizedName(locale, row.customer, row.customer.name)
    : '—';
  const productSrc = mediaSrc(row.productImageUrl);
  const reasonSrc = mediaSrc(row.reasonPhotoUrl);
  const issueSrc = mediaSrc(row.issuePhotoUrl);
  const busy =
    resolveMutation.isPending ||
    needInfoMutation.isPending ||
    receiveMutation.isPending ||
    fateMutation.isPending;

  function reasonLabel(reason: string) {
    try {
      return tc(`returnReason.${reason}` as 'returnReason.OTHER');
    } catch {
      return reason;
    }
  }

  function physicalLabel(status: string) {
    try {
      return t(`returnPhysical.${status}` as 'returnPhysical.NONE');
    } catch {
      return status;
    }
  }

  function attentionFor(): string | null {
    if (approval === 'PENDING') return t('returnAttention.pendingReview');
    if (approval === 'NEED_INFO') return t('returnAttention.needInfo');
    if (canReceive) return t('returnAttention.waitingReturn');
    if (canFate) return t('returnAttention.awaitingInspection');
    return null;
  }

  const attention = attentionFor();

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={row.number}
        description={t('returnDetail.subtitle')}
        size="lg"
        footer={
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tCommon('close')}
          </Button>
        }
      >
        <div className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {attention ? (
            <Alert variant="warning">
              <p className="font-medium">{t('returnAttention.title')}</p>
              <p className="mt-1 text-sm">{attention}</p>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--maher-surface-muted)]">
              {productSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={productSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                  <Armchair className="h-8 w-8 opacity-40" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={approval} />
                <span className="rounded-md bg-[var(--maher-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                  {physicalLabel(physical)}
                </span>
              </div>
              <h3 className="text-base font-semibold text-text-primary">{row.productDesc}</h3>
              <p className="text-sm text-text-secondary">{customerLabel}</p>
              {row.salesOrder ? (
                <p className="text-xs text-text-tertiary">
                  {tSales('systemOrderNumber')}:{' '}
                  <Link
                    href={`/sales-orders/${row.salesOrder.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    <Ltr>{row.salesOrder.number}</Ltr>
                  </Link>
                </p>
              ) : null}
              <p className="text-sm text-text-secondary">
                {reasonLabel(row.reason)} · {tc('qty')}:{' '}
                <Ltr>{Number(row.quantity)}</Ltr>
              </p>
              {row.needInfoNote ? (
                <p className="rounded-lg border border-border bg-[var(--maher-surface-muted)]/50 px-3 py-2 text-xs text-text-secondary">
                  {t('returnDetail.needInfoNote')}: {row.needInfoNote}
                </p>
              ) : null}
              {row.description ? (
                <p className="text-sm leading-relaxed text-text-secondary">{row.description}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PhotoBlock src={reasonSrc} label={tc('reasonPhoto')} empty={tc('noReturnPhoto')} />
            <PhotoBlock src={issueSrc} label={tc('issuePhoto')} empty={tc('noReturnPhoto')} />
          </div>

          {pending ? (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs text-text-secondary">{t('returnDetail.approveDoesNotReceive')}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => setConfirm({ kind: 'approve' })}>
                  {tCommon('approve')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirm({ kind: 'reject' })}
                >
                  {tCommon('reject')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || !needInfoNote.trim()}
                  loading={needInfoMutation.isPending}
                  onClick={() => setConfirm({ kind: 'need_info' })}
                >
                  {t('returnDetail.needInfo')}
                </Button>
              </div>
              <TextArea
                label={t('returnDetail.needInfoNote')}
                value={needInfoNote}
                onChange={(e) => setNeedInfoNote(e.target.value)}
                rows={3}
                placeholder={t('returnDetail.needInfoNotePlaceholder')}
              />
            </div>
          ) : null}

          {canReceive ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm text-text-secondary">{t('returnDetail.receiveHint')}</p>
              <Button
                disabled={busy}
                loading={receiveMutation.isPending}
                onClick={() => setConfirm({ kind: 'receive' })}
              >
                {t('returnDetail.confirmReturnedToFactory')}
              </Button>
            </div>
          ) : null}

          {canFate ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium text-text-primary">{ti('fatePending')}</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['RETURN_TO_STOCK', 'fateReturnToStock'],
                    ['REWORK', 'fateRework'],
                    ['DAMAGED', 'fateDamaged'],
                    ['SCRAP', 'fateScrap'],
                  ] as const
                ).map(([value, key]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant="subtle"
                    disabled={busy}
                    onClick={() => setConfirm({ kind: 'fate', fate: value })}
                  >
                    {ti(key)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {row.inventoryFate && row.inventoryFate !== 'PENDING' ? (
            <div className="flex items-center gap-2 border-t border-border pt-4">
              <span className="text-xs text-text-tertiary">{t('returnDetail.resolution')}</span>
              <StatusBadge status={row.inventoryFate} />
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm?.kind === 'approve'}
        title={tCommon('approve')}
        description={t('returnDetail.approveConfirm')}
        confirmLabel={tCommon('approve')}
        loading={resolveMutation.isPending}
        error={error}
        onConfirm={() => resolveMutation.mutate('APPROVED')}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'reject'}
        title={tCommon('reject')}
        description={t('returnDetail.rejectConfirm')}
        confirmLabel={tCommon('reject')}
        danger
        loading={resolveMutation.isPending}
        error={error}
        onConfirm={() => resolveMutation.mutate('REJECTED')}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'need_info'}
        title={t('returnDetail.needInfo')}
        description={t('returnDetail.needInfoConfirm')}
        confirmLabel={t('returnDetail.needInfo')}
        loading={needInfoMutation.isPending}
        error={error}
        onConfirm={() => needInfoMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'receive'}
        title={t('returnDetail.confirmReturnedToFactory')}
        description={t('returnDetail.receiveConfirm')}
        confirmLabel={t('returnDetail.confirmReturnedToFactory')}
        loading={receiveMutation.isPending}
        error={error}
        onConfirm={() => receiveMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'fate'}
        title={t('returnDetail.fateConfirmTitle')}
        description={t('returnDetail.fateConfirmBody')}
        confirmLabel={tCommon('confirm')}
        danger={confirm?.kind === 'fate' && (confirm.fate === 'SCRAP' || confirm.fate === 'DAMAGED')}
        loading={fateMutation.isPending}
        error={error}
        onConfirm={() => {
          if (confirm?.kind === 'fate') fateMutation.mutate(confirm.fate);
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function PhotoBlock({
  src,
  label,
  empty,
}: {
  src: string | null;
  label: string;
  empty: string;
}) {
  return (
    <div
      className={cn(
        'relative aspect-[4/3] overflow-hidden rounded-lg bg-[var(--maher-surface-muted)]',
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-text-tertiary">
          <ImageOff className="h-4 w-4 opacity-50" />
          <span className="text-center text-[10px] leading-tight">{empty}</span>
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-medium text-white">
        {label}
      </span>
    </div>
  );
}
