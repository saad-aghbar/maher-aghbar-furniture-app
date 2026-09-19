'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Input,
  Ltr,
  Modal,
  StatusBadge,
  TextArea,
  cn,
} from '@maher/ui';
import { isReturnWorkflowScope } from '@maher/types';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, ImageOff, Minus, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type {
  ReturnPiece,
  ReturnPieceDecision,
  ReturnResponsibility,
  ReturnRow,
  ReturnWorkflowOption,
} from './return-types';

const MONEY_STEP = 50;
const RETURN_CTA = 'h-10 w-full rounded-full';

function bumpMoney(value: string, delta: number): string {
  const current = Number(value);
  const next = (Number.isFinite(current) ? current : 0) + delta;
  return String(Math.max(0, Math.round(next * 100) / 100));
}

function MoneyStepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const n = Number(value);
  const atMin = !Number.isFinite(n) || n <= 0;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <div className="flex items-center overflow-hidden rounded-xl border border-border bg-[var(--maher-surface)]">
        <button
          type="button"
          aria-label="−"
          disabled={disabled || atMin}
          onClick={() => onChange(bumpMoney(value, -MONEY_STEP))}
          className="flex h-10 w-11 shrink-0 items-center justify-center text-text-primary disabled:opacity-35"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
          disabled={disabled}
          inputMode="decimal"
          aria-label={label}
          className="h-10 min-w-0 flex-1 border-x border-[var(--maher-border)] bg-transparent px-2 text-center text-sm text-text-primary outline-none focus:bg-[var(--maher-brand-soft)] disabled:opacity-60"
        />
        <span className="px-2 text-xs text-text-tertiary" dir="ltr">
          ₪
        </span>
        <button
          type="button"
          aria-label="+"
          disabled={disabled}
          onClick={() => onChange(bumpMoney(value, MONEY_STEP))}
          className="flex h-10 w-11 shrink-0 items-center justify-center text-text-primary disabled:opacity-35"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

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
  | { kind: 'decide' }
  | { kind: 'reship' }
  | { kind: 'charge' }
  | { kind: 'send_charge' }
  | { kind: 'accept_charge' }
  | { kind: 'reject_charge' }
  | { kind: 'ready' }
  | { kind: 'cancel' };

const RESPONSIBILITIES: ReturnResponsibility[] = [
  'FACTORY_WARRANTY',
  'DEALER_RESPONSIBILITY',
  'SHARED',
  'UNDETERMINED',
];

const DECISIONS: ReturnPieceDecision[] = ['REPAIR', 'REPLACEMENT', 'SCRAP_RECOVERY'];

function defaultWorkflowId(
  decision: ReturnPieceDecision,
  workflows: ReturnWorkflowOption[],
): string | undefined {
  const published = workflows.filter(
    (workflow) => isReturnWorkflowScope(workflow.scope) && workflow.status !== 'ARCHIVED',
  );
  if (!published.length) return undefined;
  if (decision === 'SCRAP_RECOVERY') {
    return published.find((workflow) => workflow.code === 'RETURN_RECOVERY')?.id ?? published[0]?.id;
  }
  return published.find((workflow) => workflow.code !== 'RETURN_RECOVERY')?.id ?? published[0]?.id;
}

type Props = {
  open: boolean;
  row: ReturnRow | null;
  onClose: () => void;
};

export function ReturnDetailSheet({ open, row, onClose }: Props) {
  const locale = useLocale();
  const t = useTranslations('lifecycle');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [needInfoNote, setNeedInfoNote] = useState('');
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [condition, setCondition] = useState('GOOD');
  const [warehouseId, setWarehouseId] = useState('');
  const [receivedLocationId, setReceivedLocationId] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [decisions, setDecisions] = useState<
    Record<string, { decision: ReturnPieceDecision; workflowId?: string }>
  >({});
  const [responsibility, setResponsibility] = useState<ReturnResponsibility>('UNDETERMINED');
  const [chargeAmount, setChargeAmount] = useState('');
  const [factoryShare, setFactoryShare] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [reshipAddress, setReshipAddress] = useState('');
  const [reshipNotes, setReshipNotes] = useState('');

  const detailQuery = useQuery({
    queryKey: ['returns', row?.id],
    queryFn: () => apiFetch<ReturnRow>(`/api/v1/returns/${row!.id}`),
    enabled: open && Boolean(row?.id),
  });
  const detail = detailQuery.data ?? row;

  const workflowsQuery = useQuery({
    queryKey: ['production-workflows', 'return-decision'],
    queryFn: () => apiFetch<ReturnWorkflowOption[]>('/api/v1/production-workflows'),
    enabled: open,
    staleTime: 60_000,
  });
  const warehousesQuery = useQuery({
    queryKey: ['warehouses', 'return-receive'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          code: string;
          nameEn?: string;
          nameAr?: string;
          locations?: Array<{
            id: string;
            code: string;
            name?: string | null;
            isDefault?: boolean;
            isActive?: boolean;
          }>;
        }>
      >('/api/v1/inventory/warehouses'),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      setError(null);
      setNeedInfoNote('');
      setConfirm(null);
      setSelectedPieceIds([]);
      setReceiveNotes('');
      setWarehouseId('');
      setReceivedLocationId('');
      setDecisions({});
      return;
    }
    if (detail) {
      setResponsibility((detail.responsibility as ReturnResponsibility) || 'UNDETERMINED');
      setChargeAmount(
        detail.chargeAmount != null && Number(detail.chargeAmount) > 0
          ? String(detail.chargeAmount)
          : '',
      );
      setFactoryShare(
        detail.factoryShareAmount != null && Number(detail.factoryShareAmount) > 0
          ? String(detail.factoryShareAmount)
          : '',
      );
    }
  }, [open, detail?.id, detail?.responsibility, detail?.chargeAmount, detail?.factoryShareAmount]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['returns'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const resolveMutation = useMutation({
    mutationFn: (approvalStatus: 'APPROVED' | 'REJECTED') =>
      apiFetch(`/api/v1/returns/${detail!.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus }),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const needInfoMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${detail!.id}/need-info`, {
        method: 'PATCH',
        body: JSON.stringify({ needInfoNote: needInfoNote.trim() }),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const receiveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${detail!.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          pieceIds: selectedPieceIds.length ? selectedPieceIds : undefined,
          receivedCondition: condition,
          warehouseId: warehouseId || undefined,
          receivedLocationId: receivedLocationId || undefined,
          receivedNotes: receiveNotes.trim() || undefined,
        }),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const decideMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${detail!.id}/decisions`, {
        method: 'POST',
        body: JSON.stringify({
          items: Object.entries(decisions).map(([pieceId, draft]) => ({
            pieceId,
            decision: draft.decision,
            workflowId: draft.workflowId,
          })),
        }),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      setDecisions({});
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const responsibilityMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${detail!.id}/responsibility`, {
        method: 'PATCH',
        body: JSON.stringify({
          responsibility,
          dealerAmount:
            (responsibility === 'DEALER_RESPONSIBILITY' ||
              responsibility === 'SHARED' ||
              responsibility === 'UNDETERMINED') &&
            Number(chargeAmount) > 0
              ? Number(chargeAmount)
              : undefined,
          factoryAmount:
            responsibility === 'SHARED' && Number(factoryShare) > 0
              ? Number(factoryShare)
              : undefined,
        }),
      }),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const chargeMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${detail!.id}/charge`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(chargeAmount || detail?.chargeAmount || 0) }),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const sendChargeMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${detail!.id}/charge/send`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const respondChargeMutation = useMutation({
    mutationFn: (input: { accept: boolean; note?: string }) =>
      apiFetch(`/api/v1/returns/${detail!.id}/charge/respond`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      setRejectNote('');
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const reshipMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${detail!.id}/reship`, {
        method: 'POST',
        body: JSON.stringify({
          address: reshipAddress.trim() || undefined,
          notes: reshipNotes.trim() || undefined,
        }),
      }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const readyMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${detail!.id}/ready-to-return`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/returns/${detail!.id}/cancel`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setConfirm(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (!detail) return null;

  const approval = (detail.approvalStatus ?? 'PENDING').toUpperCase();
  const physical = (detail.physicalStatus ?? 'NONE').toUpperCase();
  const pending = approval === 'PENDING' || approval === 'NEED_INFO';
  const pieces = detail.pieces ?? [];
  const awaiting = pieces.filter((piece) => piece.state === 'AWAITING_RECEIPT');
  const receivable = awaiting.length > 0 || (approval === 'APPROVED' && physical === 'WAITING_RETURN');
  const undecided = pieces.filter((piece) => piece.state === 'RECEIVED' && !piece.decision);
  const workflows = (workflowsQuery.data ?? []).filter((workflow) =>
    isReturnWorkflowScope(workflow.scope),
  );
  const invoice = detail.chargeInvoices?.[0];
  const customerLabel = detail.customer
    ? localizedName(locale, detail.customer, detail.customer.name)
    : '—';
  const productSrc = mediaSrc(detail.productImageUrl);
  const reasonSrc = mediaSrc(detail.reasonPhotoUrls?.[0] ?? detail.reasonPhotoUrl);
  const issueSrc = mediaSrc(detail.issuePhotoUrls?.[0] ?? detail.issuePhotoUrl);
  const busy =
    resolveMutation.isPending ||
    needInfoMutation.isPending ||
    receiveMutation.isPending ||
    decideMutation.isPending ||
    responsibilityMutation.isPending ||
    chargeMutation.isPending ||
    sendChargeMutation.isPending ||
    respondChargeMutation.isPending ||
    reshipMutation.isPending ||
    readyMutation.isPending ||
    cancelMutation.isPending;
  const actualCost = Number(detail.reworkCost?.actualTotal || 0);
  const estimatedCost = Number(detail.reworkCost?.estimatedTotal || 0);
  const productionCost = actualCost > 0 ? actualCost : estimatedCost > 0 ? estimatedCost : null;
  const chargeStatus = String(detail.chargeStatus ?? 'NOT_REQUIRED');

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
    if (receivable) return t('returnAttention.waitingReturn');
    return null;
  }

  const attention = attentionFor();

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={detail.number}
        description={t('returnDetail.subtitle')}
        size="lg"
        footer={
          <Button variant="secondary" className={RETURN_CTA} onClick={onClose} disabled={busy}>
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
              <h3 className="text-base font-semibold text-text-primary">{detail.productDesc}</h3>
              <p className="text-sm text-text-secondary">{customerLabel}</p>
              {detail.salesOrder ? (
                <p className="text-xs text-text-tertiary">
                  {tSales('systemOrderNumber')}:{' '}
                  <Link
                    href={`/admin/sales-orders/${detail.salesOrder.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    <Ltr>{detail.salesOrder.number}</Ltr>
                  </Link>
                </p>
              ) : null}
              <p className="text-sm text-text-secondary">
                {reasonLabel(detail.reason)} · {tc('qty')}:{' '}
                <Ltr>{Number(detail.quantity)}</Ltr>
              </p>
              {detail.needInfoNote ? (
                <p className="rounded-lg border border-border bg-[var(--maher-surface-muted)]/50 px-3 py-2 text-xs text-text-secondary">
                  {t('returnDetail.needInfoNote')}: {detail.needInfoNote}
                </p>
              ) : null}
              {detail.description ? (
                <p className="text-sm leading-relaxed text-text-secondary">{detail.description}</p>
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
              <div className="space-y-2">
                <Button className={RETURN_CTA} disabled={busy} onClick={() => setConfirm({ kind: 'approve' })}>
                  {tCommon('approve')}
                </Button>
                <Button
                  className={RETURN_CTA}
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirm({ kind: 'reject' })}
                >
                  {tCommon('reject')}
                </Button>
                <Button
                  className={RETURN_CTA}
                  variant="secondary"
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

          {pieces.length ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-semibold">{t('returnDetail.pieces')}</p>
              <div className="space-y-2">
                {pieces.map((piece) => (
                  <PieceRow
                    key={piece.id}
                    piece={piece}
                    workflows={workflows}
                    draft={decisions[piece.id]}
                    onDraft={(next) =>
                      setDecisions((current) => ({ ...current, [piece.id]: next }))
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}

          {receivable ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm text-text-secondary">{t('returnDetail.receiveHint')}</p>
              {awaiting.map((piece) => (
                <label key={piece.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedPieceIds.includes(piece.id)}
                    onChange={(event) => {
                      setSelectedPieceIds((current) =>
                        event.target.checked
                          ? [...current, piece.id]
                          : current.filter((id) => id !== piece.id),
                      );
                    }}
                  />
                  <Ltr>{piece.code}</Ltr>
                  <span className="text-text-secondary">{piece.productDesc}</span>
                </label>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  label={t('returnDetail.condition')}
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                />
                <label className="block text-sm">
                  <span className="mb-1 block text-text-secondary">{t('returnDetail.warehouse')}</span>
                  <select
                    className="w-full rounded-lg border border-border bg-[var(--maher-surface)] px-3 py-2 text-sm"
                    value={warehouseId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setWarehouseId(next);
                      const bins = (warehousesQuery.data ?? [])
                        .find((warehouse) => warehouse.id === next)
                        ?.locations?.filter((loc) => loc.isActive !== false);
                      setReceivedLocationId(
                        bins?.find((loc) => loc.isDefault)?.id ?? bins?.[0]?.id ?? '',
                      );
                    }}
                  >
                    <option value="">—</option>
                    {(warehousesQuery.data ?? []).map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.nameEn || warehouse.nameAr || warehouse.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-text-secondary">{t('returnDetail.bin')}</span>
                  <select
                    className="w-full rounded-lg border border-border bg-[var(--maher-surface)] px-3 py-2 text-sm"
                    value={receivedLocationId}
                    onChange={(e) => setReceivedLocationId(e.target.value)}
                    disabled={!warehouseId}
                  >
                    <option value="">—</option>
                    {(warehousesQuery.data ?? [])
                      .find((warehouse) => warehouse.id === warehouseId)
                      ?.locations?.filter((loc) => loc.isActive !== false)
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.code}
                          {loc.name ? ` — ${loc.name}` : ''}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <TextArea
                label={t('returnDetail.receiveHint')}
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                rows={2}
              />
              <Button
                className={RETURN_CTA}
                disabled={busy}
                loading={receiveMutation.isPending}
                onClick={() => setConfirm({ kind: 'receive' })}
              >
                {t('returnDetail.receivePieces')}
              </Button>
            </div>
          ) : null}

          {undecided.length ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-semibold">{t('returnDetail.decision')}</p>
              <Button
                className={RETURN_CTA}
                disabled={busy || !Object.keys(decisions).length}
                onClick={() => setConfirm({ kind: 'decide' })}
              >
                {t('returnDetail.decision')}
              </Button>
            </div>
          ) : null}

          {pieces.some((piece) => (piece.recoveryLines ?? []).length > 0) ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-semibold">{t('returnDetail.recovery')}</p>
              {pieces.flatMap((piece) =>
                (piece.recoveryLines ?? []).map((line) => (
                  <p key={line.id} className="text-sm text-text-secondary">
                    <Ltr>{piece.code}</Ltr> · {line.label} · {String(line.quantity)} {line.unit} ·{' '}
                    {line.outcome}
                  </p>
                )),
              )}
            </div>
          ) : null}

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">{t('returnDetail.responsibility')}</p>
            <p className="text-xs text-text-secondary">{t('returnDetail.chargeHint')}</p>
            {chargeStatus !== 'NOT_REQUIRED' ? (
              <p className="text-xs text-text-tertiary">
                {t('returnDetail.chargeStatus')}:{' '}
                {t(`returnDetail.chargeStatuses.${chargeStatus}` as 'returnDetail.chargeStatuses.DRAFT')}
              </p>
            ) : null}
            <select
              className="w-full rounded-lg border border-border bg-[var(--maher-surface)] px-3 py-2 text-sm"
              value={responsibility}
              onChange={(e) => setResponsibility(e.target.value as ReturnResponsibility)}
              disabled={chargeStatus === 'INVOICED'}
            >
              {RESPONSIBILITIES.map((option) => (
                <option key={option} value={option}>
                  {t(`returnDetail.responsibilityOption.${option}`)}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary">
              {productionCost != null ? (
                <>
                  {t('returnDetail.productionCost')} <Ltr>{productionCost}</Ltr>
                </>
              ) : (
                t('returnDetail.productionCostUnknown')
              )}
            </p>
            {responsibility === 'FACTORY_WARRANTY' ? (
              <p className="text-xs text-[var(--maher-success)]">{t('returnDetail.factoryAbsorbs')}</p>
            ) : null}
            {responsibility === 'DEALER_RESPONSIBILITY' ||
            responsibility === 'SHARED' ||
            responsibility === 'UNDETERMINED' ? (
              <MoneyStepper
                label={
                  responsibility === 'UNDETERMINED'
                    ? t('returnDetail.pendingAgreement')
                    : t('returnDetail.chargeAmount')
                }
                value={chargeAmount}
                onChange={setChargeAmount}
                disabled={chargeStatus === 'INVOICED'}
              />
            ) : null}
            {responsibility === 'SHARED' ? (
              <MoneyStepper
                label={t('returnDetail.factoryShare')}
                value={factoryShare}
                onChange={setFactoryShare}
                disabled={chargeStatus === 'INVOICED'}
              />
            ) : null}
            {chargeStatus === 'REJECTED' && detail.chargeRejectionNote ? (
              <p className="text-xs text-[var(--maher-warning)]">
                {t('returnDetail.rejectionNote')}: {detail.chargeRejectionNote}
              </p>
            ) : null}
            <div className="space-y-2">
              <Button
                className={RETURN_CTA}
                variant="secondary"
                disabled={busy || chargeStatus === 'INVOICED'}
                loading={responsibilityMutation.isPending}
                onClick={() => responsibilityMutation.mutate()}
              >
                {tCommon('save')}
              </Button>
              {chargeStatus === 'DRAFT' ? (
                <Button className={RETURN_CTA} disabled={busy} onClick={() => setConfirm({ kind: 'send_charge' })}>
                  {t('returnDetail.sendToDealer')}
                </Button>
              ) : null}
              {chargeStatus === 'AWAITING_DEALER' ? (
                <>
                  <p className="text-xs text-text-tertiary">
                    {t('returnDetail.factoryOverrideHint')}
                  </p>
                  <Input
                    label={t('returnDetail.rejectionNote')}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <Button className={RETURN_CTA} disabled={busy} onClick={() => setConfirm({ kind: 'accept_charge' })}>
                    {t('returnDetail.recordAccept')}
                  </Button>
                  <Button
                    className={RETURN_CTA}
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setConfirm({ kind: 'reject_charge' })}
                  >
                    {t('returnDetail.recordReject')}
                  </Button>
                </>
              ) : null}
              {chargeStatus === 'CONFIRMED' && !invoice ? (
                <Button className={RETURN_CTA} disabled={busy} onClick={() => setConfirm({ kind: 'charge' })}>
                  {t('returnDetail.charge')}
                </Button>
              ) : null}
            </div>
            {invoice ? (
              <Link href={`/admin/invoices/${invoice.id}`} className="text-sm font-medium text-brand hover:underline">
                {t('returnDetail.invoice')}: <Ltr>{invoice.number}</Ltr>
              </Link>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Input
              label={t('returnDetail.reshipAddress')}
              value={reshipAddress}
              onChange={(e) => setReshipAddress(e.target.value)}
            />
            <TextArea
              label={t('returnDetail.reshipNotes')}
              value={reshipNotes}
              onChange={(e) => setReshipNotes(e.target.value)}
              rows={2}
            />
            <div className="space-y-2">
              <Button className={RETURN_CTA} variant="secondary" disabled={busy} onClick={() => setConfirm({ kind: 'ready' })}>
                {t('returnDetail.ready')}
              </Button>
              <Button className={RETURN_CTA} disabled={busy} onClick={() => setConfirm({ kind: 'reship' })}>
                {t('returnDetail.reship')}
              </Button>
              <Button
                className={RETURN_CTA}
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm({ kind: 'cancel' })}
              >
                {t('returnDetail.cancel')}
              </Button>
            </div>
            {(detail.reshipDeliveries ?? []).map((delivery) => (
              <p key={delivery.id} className="text-xs text-text-secondary">
                <Link href={`/admin/deliveries/${delivery.id}`} className="text-brand hover:underline">
                  <Ltr>{delivery.number}</Ltr>
                </Link>
                {delivery.deliveryDate ? ` · ${String(delivery.deliveryDate).slice(0, 10)}` : null}
              </p>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
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
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'reject'}
        title={tCommon('reject')}
        description={t('returnDetail.rejectConfirm')}
        confirmLabel={tCommon('reject')}
        danger
        loading={resolveMutation.isPending}
        error={error}
        onClose={() => setConfirm(null)}
        onConfirm={() => resolveMutation.mutate('REJECTED')}
      />
      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
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
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'receive'}
        title={t('returnDetail.confirmReturnedToFactory')}
        description={t('returnDetail.receiveConfirm')}
        confirmLabel={t('returnDetail.receivePieces')}
        loading={receiveMutation.isPending}
        error={error}
        onConfirm={() => receiveMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'decide'}
        title={t('returnDetail.decision')}
        description={t('returnDetail.decision')}
        confirmLabel={t('returnDetail.decision')}
        loading={decideMutation.isPending}
        error={error}
        onConfirm={() => decideMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'charge'}
        title={t('returnDetail.charge')}
        description={`${t('returnDetail.chargeAmount')}: ${chargeAmount || detail.chargeAmount || ''}`}
        confirmLabel={t('returnDetail.charge')}
        loading={chargeMutation.isPending}
        error={error}
        onConfirm={() => chargeMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'send_charge'}
        title={t('returnDetail.sendToDealer')}
        description={t('returnDetail.sendToDealer')}
        confirmLabel={t('returnDetail.sendToDealer')}
        loading={sendChargeMutation.isPending}
        error={error}
        onConfirm={() => sendChargeMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'accept_charge'}
        title={t('returnDetail.recordAccept')}
        description={t('returnDetail.factoryOverrideHint')}
        confirmLabel={t('returnDetail.recordAccept')}
        loading={respondChargeMutation.isPending}
        error={error}
        onConfirm={() => respondChargeMutation.mutate({ accept: true })}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'reject_charge'}
        title={t('returnDetail.recordReject')}
        description={t('returnDetail.rejectionNote')}
        confirmLabel={t('returnDetail.recordReject')}
        loading={respondChargeMutation.isPending}
        error={error}
        onConfirm={() => respondChargeMutation.mutate({ accept: false, note: rejectNote.trim() })}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'reship'}
        title={t('returnDetail.reship')}
        description={t('returnDetail.reship')}
        confirmLabel={t('returnDetail.reship')}
        loading={reshipMutation.isPending}
        error={error}
        onConfirm={() => reshipMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'ready'}
        title={t('returnDetail.ready')}
        description={t('returnDetail.ready')}
        confirmLabel={t('returnDetail.ready')}
        loading={readyMutation.isPending}
        error={error}
        onConfirm={() => readyMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        ctaClassName="h-10 rounded-full"
        open={confirm?.kind === 'cancel'}
        title={t('returnDetail.cancel')}
        description={t('returnDetail.cancel')}
        confirmLabel={t('returnDetail.cancel')}
        danger
        loading={cancelMutation.isPending}
        error={error}
        onConfirm={() => cancelMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function PieceRow({
  piece,
  workflows,
  draft,
  onDraft,
}: {
  piece: ReturnPiece;
  workflows: ReturnWorkflowOption[];
  draft?: { decision: ReturnPieceDecision; workflowId?: string };
  onDraft: (next: { decision: ReturnPieceDecision; workflowId?: string }) => void;
}) {
  const t = useTranslations('lifecycle');
  const decidable = piece.state === 'RECEIVED' && !piece.decision;
  return (
    <div className="rounded-lg border border-border bg-[var(--maher-surface-muted)]/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Ltr className="text-sm font-semibold">{piece.code}</Ltr>
        <StatusBadge status={piece.state} />
      </div>
      <p className="text-xs text-text-secondary">
        {piece.productDesc}
        {piece.decision ? ` · ${piece.decision}` : ''}
      </p>
      {piece.productionOrder ? (
        <Link
          href={`/admin/production/${piece.productionOrder.id}`}
          className="text-xs text-brand hover:underline"
        >
          <Ltr>{piece.productionOrder.number}</Ltr>
        </Link>
      ) : null}
      {piece.recoveryOrder ? (
        <Link
          href={`/admin/production/${piece.recoveryOrder.id}`}
          className="text-xs text-brand hover:underline"
        >
          {t('returns.recoveryWorkOrder')}: <Ltr>{piece.recoveryOrder.number}</Ltr>
        </Link>
      ) : null}
      {piece.state === 'RECOVERED' ? (
        <p className="text-xs text-text-secondary">{t('returns.quarantineWrittenOff')}</p>
      ) : null}
      {decidable ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-lg border border-border bg-[var(--maher-surface)] px-3 py-2 text-sm"
            value={draft?.decision ?? ''}
            onChange={(e) => {
              const decision = e.target.value as ReturnPieceDecision;
              onDraft({
                decision,
                workflowId: defaultWorkflowId(decision, workflows),
              });
            }}
          >
            <option value="">—</option>
            {DECISIONS.map((decision) => (
              <option key={decision} value={decision}>
                {decision}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-border bg-[var(--maher-surface)] px-3 py-2 text-sm"
            value={draft?.workflowId ?? ''}
            disabled={!draft?.decision}
            onChange={(e) => {
              if (!draft) return;
              onDraft({ ...draft, workflowId: e.target.value || undefined });
            }}
          >
            <option value="">{t('returnDetail.workflow')}</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.nameEn || workflow.code}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
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
