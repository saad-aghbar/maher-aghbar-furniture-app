'use client';

import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { fabricTakeInErrorKey, verdictFabricTakeInScan, type FabricTaskBoard, type FabricTaskBoardItem } from '@/lib/fabric-take-in-scan';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { Alert, Board, BoardSkeleton, Button, Input, Ltr, Meter, NumberField, Sheet, Stamp, TextArea, useOptionalCodeScanner, useToast } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * TaskFabricBoard — worker-side fabric take-in (port of mobile). Lists the
 * dealer fabric this stage needs, lets the worker scan (or type) the bundle
 * code to take it in, and exposes `openDisposition` for the finish flow.
 */
export function useTaskFabric(taskId: string, enabled: boolean) {
  const board = useQuery({
    queryKey: ['task-fabric-board', taskId],
    queryFn: () => apiFetch<FabricTaskBoard>(`/api/v1/fabric-procurements/tasks/${taskId}/board`),
    enabled,
    retry: false,
    staleTime: 15_000,
  });
  const items = board.data?.items ?? [];
  const relevant = items.length > 0;
  const allTaken = relevant && (board.data?.taken ?? 0) >= (board.data?.total ?? 0);
  // Bundles taken into this stage whose leftovers have not been recorded yet.
  const openLots = items.flatMap((i) => i.lots.filter((l) => l.qrCode && String(l.status).toUpperCase() === 'ISSUED'));
  return { board, items, relevant, allTaken, openLots };
}

export function TaskFabricBoard({ taskId, salesOrderId, canAct }: { taskId: string; salesOrderId?: string | null; canAct: boolean }) {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();
  const scanner = useOptionalCodeScanner();
  const { board, items, relevant } = useTaskFabric(taskId, true);
  const [manual, setManual] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  const takeIn = useMutation({
    mutationFn: (qrCode: string) => apiFetch(`/api/v1/fabric-procurements/tasks/${taskId}/take-in`, { method: 'POST', body: JSON.stringify({ qrCode }) }),
    onSuccess: async () => {
      toast.success(t('fabricTakeInSuccess'));
      setWarning(null);
      setManual('');
      await Promise.all([qc.invalidateQueries({ queryKey: ['task-fabric-board', taskId] }), qc.invalidateQueries({ queryKey: ['task', taskId] }), qc.invalidateQueries({ queryKey: ['order-fabric-tracker'] })]);
    },
    onError: (err) => {
      const code = err instanceof ApiClientError ? err.body?.code : undefined;
      const key = fabricTakeInErrorKey(code);
      setWarning(key ? t(key as never) : mutationErrorMessage(err));
    },
  });

  const handleCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // Only look the lot up when it is not one of ours (to tell "wrong order" from "unknown");
    // workers may lack inventory.read, so a failure here is not an error.
    const known = items.some((i) => i.lots.some((l) => l.qrCode && l.qrCode.toUpperCase() === trimmed.toUpperCase()));
    let scannedLot: { salesOrderId?: string | null; salesOrderNumber?: string | null } | null = null;
    if (!known) {
      try {
        scannedLot = await apiFetch(`/api/v1/inventory/lots/by-code/${encodeURIComponent(trimmed)}`);
      } catch {
        scannedLot = null;
      }
    }
    const verdict = verdictFabricTakeInScan({ code: trimmed, items, taskSalesOrderId: salesOrderId ?? null, scannedLot });
    if (verdict.kind !== 'match') {
      const key = fabricTakeInErrorKey(verdict.kind);
      setWarning(key ? t(key as never) : t('fabricWrongFabric'));
      return;
    }
    takeIn.mutate(trimmed);
  };

  if (board.isLoading) return <BoardSkeleton rows={2} />;
  if (!relevant) return null;
  const taken = board.data?.taken ?? 0;
  const total = board.data?.total ?? items.length;

  return (
    <Board tone={taken >= total ? 'success' : 'warning'}>
      <Board.Header
        title={t('fabricTakeInTitle')}
        description={t('fabricTakeInHint')}
        meta={
          <Stamp tone={taken >= total ? 'success' : 'warning'} size="sm">
            {t('fabricProgress', { taken, total })}
          </Stamp>
        }
        actions={
          canAct && taken < total && scanner ? (
            <Button
              size="sm"
              leadingIcon={<ScanLine className="h-4 w-4" />}
              onClick={async () => {
                const code = await scanner.openScanner({ title: t('fabricTakeInTitle') });
                if (code) await handleCode(code);
              }}
            >
              {t('fabricScanCta')}
            </Button>
          ) : null
        }
      />
      <Board.Body padding="none">
        <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
          {items.map((item) => (
            <FabricItemRow key={item.id} item={item} />
          ))}
        </ul>
        {canAct && taken < total ? (
          <div className="border-t border-[var(--maher-border)] px-5 py-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCode(manual);
              }}
            >
              <Input label={t('fabricEnterCode')} value={manual} onChange={(e) => setManual(e.target.value)} dir="ltr" className="flex-1" />
              <Button type="submit" variant="secondary" loading={takeIn.isPending} disabled={!manual.trim()}>
                {t('fabricTake')}
              </Button>
            </form>
            {warning ? (
              <Alert variant="warning" className="mt-3">
                {warning}
              </Alert>
            ) : null}
          </div>
        ) : null}
        <p className="sr-only">{tCommon('scan')}</p>
      </Board.Body>
    </Board>
  );
}

function FabricItemRow({ item }: { item: FabricTaskBoardItem }) {
  const t = useTranslations('production');
  const tStatus = useTranslations('statuses');
  const taken = item.issuedQty > 0;
  const expected = item.expectedQty ?? 0;
  const status = (s?: string) => {
    if (!s) return '—';
    if (tStatus.has(s as never)) return tStatus(s as never);
    const t = s.replace(/_/g, ' ').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <InventoryItemThumb src={item.imageUrl} alt="" size={44} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">{item.label}</span>
          {item.role ? (
            <Stamp tone="neutral" size="sm">
              {item.role}
            </Stamp>
          ) : null}
        </span>
        <span className="block text-[12px] text-[var(--maher-text-secondary)]">
          {taken ? t('fabricTaken') : item.readyForProduction || item.arrivedQty > 0 ? status(item.derivedStatus) : t('fabricWaiting')}
          {item.lots.length ? (
            <>
              {' · '}
              <Ltr>{item.lots.map((l) => l.qrCode).filter(Boolean).join(', ')}</Ltr>
            </>
          ) : null}
        </span>
        {expected > 0 ? <Meter value={Math.min(taken ? item.issuedQty : item.arrivedQty, expected)} max={expected} size="sm" tone={taken || item.arrivedQty >= expected ? 'success' : 'info'} showValue={false} className="mt-1.5 max-w-[240px]" /> : null}
      </span>
      <span className="shrink-0 text-end text-[12px] tabular-nums text-[var(--maher-text-secondary)]" dir="ltr">
        {taken ? item.issuedQty : item.arrivedQty}/{expected || '—'} {item.unit ?? ''}
      </span>
      <Stamp tone={taken ? 'success' : item.readyForProduction ? 'info' : 'warning'} />
    </li>
  );
}

/**
 * Disposition sheet: for each taken bundle, how much goes back to holding and
 * how much was scrap. Posts `POST /fabric-procurements/tasks/:taskId/disposition`.
 */
export function FabricDispositionSheet({ taskId, open, onClose, onDone }: { taskId: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();
  const { items } = useTaskFabric(taskId, open);
  const lots = items.flatMap((item) => item.lots.filter((l) => l.qrCode && String(l.status).toUpperCase() === 'ISSUED').map((l) => ({ ...l, itemLabel: item.label, unit: item.unit ?? '' })));
  const [rows, setRows] = useState<Record<string, { returnedQty: number | null; scrapQty: number | null; scrapReason: string }>>({});
  const save = useMutation({
    mutationFn: async () => {
      for (const lot of lots) {
        const r = rows[lot.qrCode!];
        if (!r || (r.returnedQty == null && r.scrapQty == null)) continue;
        await apiFetch(`/api/v1/fabric-procurements/tasks/${taskId}/disposition`, {
          method: 'POST',
          body: JSON.stringify({ qrCode: lot.qrCode, returnedQty: r.returnedQty ?? undefined, scrapQty: r.scrapQty ?? undefined, scrapReason: r.scrapReason.trim() || undefined }),
        });
      }
    },
    onSuccess: async () => {
      toast.success(t('fabricDispositionSaved'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['task-fabric-board', taskId] }), qc.invalidateQueries({ queryKey: ['order-fabric-tracker'] }), qc.invalidateQueries({ queryKey: ['inventory-fabric-holding'] })]);
      onDone();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('fabricDisposition')}
      description={t('fabricDispositionHint')}
      closeLabel={tCommon('close')}
      footer={
        <>
          <Button variant="ghost" onClick={onDone} disabled={save.isPending}>
            {tCommon('skip')}
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {tCommon('saveAndContinue')}
          </Button>
        </>
      }
    >
      {lots.length === 0 ? (
        <p className="text-[13px] text-[var(--maher-text-tertiary)]">{t('fabricWaiting')}</p>
      ) : (
        <ul className="m-0 list-none space-y-4 p-0">
          {lots.map((lot) => {
            const r = rows[lot.qrCode!] ?? { returnedQty: null, scrapQty: null, scrapReason: '' };
            const set = (patch: Partial<typeof r>) => setRows((prev) => ({ ...prev, [lot.qrCode!]: { ...r, ...patch } }));
            return (
              <li key={lot.id} className="rounded-[12px] border border-[var(--maher-border)] p-3">
                <p className="m-0 mb-2 flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-semibold text-[var(--maher-text-primary)]">{lot.itemLabel}</span>
                  <Ltr className="text-[var(--maher-text-tertiary)]">{lot.qrCode}</Ltr>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField label={t('fabricLeftover')} unit={lot.unit} value={r.returnedQty} onChange={(v) => set({ returnedQty: v })} min={0} decimals={2} />
                  <NumberField label={t('fabricScrap')} unit={lot.unit} value={r.scrapQty} onChange={(v) => set({ scrapQty: v })} min={0} decimals={2} />
                </div>
                {r.scrapQty ? <TextArea autoGrow rows={2} label={t('fabricScrapReason')} value={r.scrapReason} onChange={(e) => set({ scrapReason: e.target.value })} className="mt-3" /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
