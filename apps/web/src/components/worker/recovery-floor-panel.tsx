'use client';

import type { ReturnPiece } from '@/components/returns/return-types';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { isRecoveryFinishBlocked } from '@/lib/task-quality-kind';
import { localizedName } from '@maher/i18n';
import { Alert, Board, BoardSkeleton, Button, Combobox, Input, Ledger, LedgerRow, Ltr, NumberField, SegmentedControl, Sheet, Stamp, TextArea, useToast } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type Outcome = 'RECOVER_TO_INVENTORY' | 'DISPOSE' | 'DAMAGED';
interface RecoveryLine {
  id: string;
  label: string;
  quantity: number | string;
  unit: string;
  outcome: Outcome | string;
  postedAt?: string | null;
  inventoryItem?: { id: string; sku: string; nameEn: string; nameAr?: string | null } | null;
  destinationWarehouse?: { id: string; code: string; nameEn?: string } | null;
  destinationLocation?: { id: string; code: string; name?: string | null } | null;
}
interface ReturnDetail {
  id: string;
  number: string;
  pieces?: Array<Omit<ReturnPiece, 'recoveryLines'> & { recoveryLines?: RecoveryLine[] }>;
}
interface Warehouse {
  id: string;
  code: string;
  nameEn?: string;
  nameAr?: string;
  type?: string;
  isActive?: boolean;
  locations?: Array<{ id: string; code: string; name?: string | null; isActive?: boolean }>;
}
interface StockItem {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string | null;
  unit?: string | null;
}

export function useRecoveryPiece(returnRequestId: string | null | undefined, returnPieceId: string | null | undefined) {
  const q = useQuery({
    queryKey: ['return', returnRequestId],
    enabled: Boolean(returnRequestId),
    queryFn: () => apiFetch<ReturnDetail>(`/api/v1/returns/${returnRequestId}`),
  });
  const piece = (q.data?.pieces ?? []).find((p) => p.id === returnPieceId) ?? null;
  const lines = piece?.recoveryLines ?? [];
  return { query: q, piece, lines, finishBlocked: isRecoveryFinishBlocked(lines) };
}

/**
 * RecoveryFloorPanel — the dismantle & recover floor (port of mobile
 * TaskRecoveryFloorSection). Log every part pulled off the returned piece as
 * recovered (into a warehouse bin), disposed or damaged; post each line to
 * inventory. The task can only finish once every line is posted.
 */
export function RecoveryFloorPanel({ taskId, returnRequestId, returnPieceId, readOnly }: { taskId: string; returnRequestId: string; returnPieceId: string; readOnly: boolean }) {
  const t = useTranslations('mobile.returns');
  const tCommon = useTranslations('common');
  const ti = useTranslations('inventory');
  const locale = useLocale();
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const { query, piece, lines, finishBlocked } = useRecoveryPiece(returnRequestId, returnPieceId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ outcome: Outcome; inventoryItemId: string | null; label: string; quantity: number | null; unit: string; warehouseId: string | null; locationId: string | null; notes: string }>({ outcome: 'RECOVER_TO_INVENTORY', inventoryItemId: null, label: '', quantity: 1, unit: 'pcs', warehouseId: null, locationId: null, notes: '' });

  const warehouses = useQuery({
    queryKey: ['recovery-warehouses'],
    enabled: open,
    queryFn: () => apiFetch<Warehouse[]>('/api/v1/inventory/warehouses?type=RAW_MATERIALS'),
    staleTime: 60_000,
  });
  const stock = useQuery({
    queryKey: ['inventory-items', 'recovery-pick'],
    enabled: open,
    queryFn: () => apiFetch<{ data: StockItem[] }>('/api/v1/inventory/items?itemClass=RAW_MATERIAL&pageSize=200').then((r) => r.data ?? []),
    staleTime: 60_000,
  });
  const selectedWh = useMemo(() => (warehouses.data ?? []).find((w) => w.id === draft.warehouseId) ?? null, [warehouses.data, draft.warehouseId]);
  const bins = (selectedWh?.locations ?? []).filter((b) => b.isActive !== false);
  const recover = draft.outcome === 'RECOVER_TO_INVENTORY';

  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: ['return', returnRequestId] }), qc.invalidateQueries({ queryKey: ['task', taskId] })]);
  const add = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/returns/${returnRequestId}/pieces/${returnPieceId}/recovery-lines`, {
        method: 'POST',
        body: JSON.stringify({
          productionTaskId: taskId,
          inventoryItemId: recover ? draft.inventoryItemId ?? undefined : undefined,
          label: draft.label.trim() || (stock.data ?? []).find((s) => s.id === draft.inventoryItemId)?.nameEn || '—',
          quantity: draft.quantity ?? 1,
          unit: draft.unit || 'pcs',
          outcome: draft.outcome,
          destinationWarehouseId: recover ? draft.warehouseId ?? undefined : undefined,
          destinationLocationId: recover ? draft.locationId ?? undefined : undefined,
          notes: draft.notes.trim() || undefined,
        }),
      }),
    onSuccess: async () => {
      toast.success(t('recoverySaved'));
      setOpen(false);
      setDraft((d) => ({ ...d, inventoryItemId: null, label: '', quantity: 1, notes: '' }));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const post = useMutation({
    mutationFn: (lineId: string) => apiFetch(`/api/v1/returns/${returnRequestId}/recovery-lines/${lineId}/post`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success(t('recoveryPosted'));
      await Promise.all([invalidate(), qc.invalidateQueries({ queryKey: ['inventory-items'] })]);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (lineId: string) => apiFetch(`/api/v1/returns/${returnRequestId}/recovery-lines/${lineId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('recoveryDeleted'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  if (query.isLoading) return <BoardSkeleton rows={4} />;
  if (query.isError || !query.data) return <Alert variant="warning">{t('recoveryEmpty')}</Alert>;
  const outcomeLabel = (o: string) => (t.has(`recoveryOutcome.${o}` as never) ? t(`recoveryOutcome.${o}` as never) : o);
  const outcomeTone = (o: string) => (o === 'RECOVER_TO_INVENTORY' ? 'success' : o === 'DISPOSE' ? 'neutral' : 'warning');
  const canAddValid = (draft.quantity ?? 0) > 0 && (recover ? Boolean(draft.inventoryItemId && draft.warehouseId && (bins.length === 0 || draft.locationId)) : Boolean(draft.label.trim()));

  return (
    <>
      <Board tone={finishBlocked ? 'warning' : 'success'}>
        <Board.Header
          title={t('recoveryWorkTitle')}
          description={t('recoveryWorkHint')}
          meta={<Stamp tone={finishBlocked ? 'warning' : 'success'} size="sm">{t('recoveryCase', { number: query.data.number })}</Stamp>}
          actions={
            !readOnly ? (
              <Button size="sm" leadingIcon={<PackagePlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
                {t('recoveryAdd')}
              </Button>
            ) : null
          }
        />
        <Board.Body padding="none">
          {piece ? (
            <p className="m-0 border-b border-[var(--maher-border)] px-5 py-2.5 text-[12px] text-[var(--maher-text-secondary)]">
              {t('recoveryPiece', { piece: piece.code })} · {piece.productDesc}
              {piece.decision ? ` · ${t('recoveryDecision', { decision: String(piece.decision).replace(/_/g, ' ').toLowerCase() })}` : ''}
            </p>
          ) : null}
          {lines.length === 0 ? (
            <Board.Empty title={t('recoveryEmpty')} description={t('recoveryStripHint')} />
          ) : (
            <Ledger>
              {lines.map((l) => (
                <LedgerRow
                  key={l.id}
                  label={l.inventoryItem ? localizedName(locale, l.inventoryItem, l.label) : l.label}
                  hint={[l.inventoryItem?.sku, l.destinationWarehouse ? t('recoveryPutInto', { place: l.destinationLocation ? `${l.destinationWarehouse.code} · ${l.destinationLocation.name ?? l.destinationLocation.code}` : l.destinationWarehouse.code }) : l.outcome !== 'RECOVER_TO_INVENTORY' ? t('recoveryWasteCaption') : null].filter(Boolean).join(' · ')}
                  tone={outcomeTone(l.outcome)}
                  stamp
                  value={
                    <span className="flex items-center gap-2">
                      <Ltr>
                        {String(l.quantity)} {l.unit}
                      </Ltr>
                      <Stamp tone={outcomeTone(l.outcome)} size="sm">
                        {outcomeLabel(l.outcome)}
                      </Stamp>
                      {l.postedAt ? (
                        <Stamp tone="success" size="sm">
                          {t('recoveryPosted')}
                        </Stamp>
                      ) : !readOnly ? (
                        <>
                          <Button size="sm" variant="secondary" leadingIcon={<Send className="h-3.5 w-3.5 rtl:-scale-x-100" />} loading={post.isPending && post.variables === l.id} onClick={() => post.mutate(l.id)}>
                            {t('recoveryPost')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove.mutate(l.id)} aria-label={t('recoveryRemovePart')}>
                            ×
                          </Button>
                        </>
                      ) : null}
                    </span>
                  }
                />
              ))}
            </Ledger>
          )}
          <p className="m-0 px-5 py-2.5 text-[12px] text-[var(--maher-text-tertiary)]">{finishBlocked ? t('recoveryFinishRule') : t('recoveryFinish')}</p>
        </Board.Body>
      </Board>

      <Sheet open={open} onClose={() => !add.isPending && setOpen(false)} title={t('recoverySheetTitle')} description={recover ? t('recoveryHintRecover') : draft.outcome === 'DISPOSE' ? t('recoveryHintDispose') : t('recoveryHintDamaged')} closeLabel={tCommon('close')} footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={add.isPending}>
            {tCommon('cancel')}
          </Button>
          <Button loading={add.isPending} disabled={!canAddValid} onClick={() => add.mutate()}>
            {t('recoverySave')}
          </Button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{t('recoveryOutcomeLabel')}</span>
            <SegmentedControl fill aria-label={t('recoveryOutcomeLabel')} value={draft.outcome} onChange={(v) => setDraft((d) => ({ ...d, outcome: v as Outcome }))} options={(['RECOVER_TO_INVENTORY', 'DISPOSE', 'DAMAGED'] as Outcome[]).map((o) => ({ value: o, label: outcomeLabel(o) }))} />
          </div>
          {recover ? (
            <>
              <Combobox label={t('recoveryLabel')} value={draft.inventoryItemId} onChange={(v) => setDraft((d) => ({ ...d, inventoryItemId: v, unit: (stock.data ?? []).find((s) => s.id === v)?.unit ?? d.unit }))} options={(stock.data ?? []).map((s) => ({ value: s.id, label: localizedName(locale, s, s.nameEn), description: s.sku }))} emptyText={kit.combobox.empty} loadingText={kit.combobox.loading} clearLabel={kit.combobox.clear} />
              <Combobox label={t('recoveryWarehouse')} value={draft.warehouseId} onChange={(v) => setDraft((d) => ({ ...d, warehouseId: v, locationId: (warehouses.data ?? []).find((w) => w.id === v)?.locations?.find((l) => l.isActive !== false)?.id ?? null }))} options={(warehouses.data ?? []).filter((w) => w.isActive !== false).map((w) => ({ value: w.id, label: localizedName(locale, w, w.code), description: w.code }))} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} placeholder={t('recoverySearchWarehouse')} />
              {bins.length ? <Combobox label={t('recoveryLocation')} value={draft.locationId} onChange={(v) => setDraft((d) => ({ ...d, locationId: v }))} options={bins.map((b) => ({ value: b.id, label: b.name && b.name !== b.code ? `${b.code} · ${b.name}` : b.code }))} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} placeholder={t('recoverySearchBin')} /> : null}
            </>
          ) : (
            <Input label={t('recoveryLabel')} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label={ti('quantity')} value={draft.quantity} onChange={(v) => setDraft((d) => ({ ...d, quantity: v }))} min={0} decimals={2} />
            <Input label={ti('unit')} value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} dir="ltr" />
          </div>
          <TextArea autoGrow rows={2} label={tCommon('notes')} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
          {!canAddValid ? <p className="m-0 text-[12px] text-[var(--maher-text-tertiary)]">{t('recoveryValidation')}</p> : null}
        </div>
      </Sheet>
    </>
  );
}
