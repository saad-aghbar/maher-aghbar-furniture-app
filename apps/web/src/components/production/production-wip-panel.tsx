'use client';

import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { useKitCopy } from '@/lib/kit-copy';
import { Board, BoardSkeleton, Button, Combobox, QrDisplay, Sheet, Stamp, useToast, type BoardTone } from '@maher/ui';
import { FileText, MoveRight } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

type WipKit = {
  id: string;
  status: string;
  qrCode: string;
  expectedPieceCount: number;
  custody?: string | null;
  handoffCount?: number;
  pieces: Array<{ id: string }>;
  location?: { id?: string; code: string; name?: string | null } | null;
  claimedByUser?: { firstName: string; lastName: string } | null;
  productionOrder: { number: string };
  stageInstance?: {
    stageDefinition?: {
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
    };
  };
};

type WipSection = {
  stageCode: string;
  stageNameEn: string;
  stageNameAr: string;
  stageNameHe: string | null;
  kits: WipKit[];
};

type Props = {
  productionOrderId: string;
};

type StageBin = { id: string; code: string; name?: string | null; isDefault?: boolean };

function stageName(section: WipSection, locale: string): string {
  if (locale === 'ar') return section.stageNameAr || section.stageNameEn;
  if (locale === 'he') return section.stageNameHe || section.stageNameEn;
  return section.stageNameEn;
}

function directionForKit(status: string): 'outgoing' | 'incoming' | 'in_use' | 'other' {
  const s = String(status ?? '').toUpperCase();
  if (s === 'READY' || s === 'OPEN') return 'outgoing';
  if (s === 'CLAIMED') return 'incoming';
  if (s === 'CONSUMED') return 'in_use';
  return 'other';
}

export function ProductionWipPanel({ productionOrderId }: Props) {
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const kitCopy = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const { openPdf, pdfDialog } = usePdfDownload();
  const locale = useLocale();
  const [moving, setMoving] = useState<WipKit | null>(null);
  const [targetBin, setTargetBin] = useState<string | null>(null);

  const binsQuery = useQuery({
    queryKey: ['wip-stage-bins'],
    queryFn: () => apiFetch<{ warehouse: { id: string; code: string } | null; locations: StageBin[] }>('/api/v1/inventory/wip-kits/stage-bins'),
    staleTime: 60_000,
  });
  const bins = binsQuery.data?.locations ?? [];
  const ensureBins = useMutation({
    mutationFn: () => apiFetch('/api/v1/inventory/wip-kits/ensure-stage-bins', { method: 'POST' }),
    onSuccess: async () => {
      toast.success(tp('hubWipBinsCreated'));
      await qc.invalidateQueries({ queryKey: ['wip-stage-bins'] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const moveKit = useMutation({
    mutationFn: (args: { kitId: string; locationId: string | null }) => apiFetch(`/api/v1/inventory/wip-kits/${args.kitId}/location`, { method: 'PATCH', body: JSON.stringify({ locationId: args.locationId }) }),
    onSuccess: async () => {
      toast.success(tp('hubWipMoved'));
      setMoving(null);
      await qc.invalidateQueries({ queryKey: ['production-order-wip', productionOrderId] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const boardQuery = useQuery({
    queryKey: ['production-order-wip', productionOrderId],
    queryFn: () =>
      apiFetch<{ sections: WipSection[]; totalKits: number }>(
        `/api/v1/inventory/wip-kits/board?productionOrderId=${encodeURIComponent(productionOrderId)}&scope=active`,
      ),
    enabled: Boolean(productionOrderId),
  });

  const sections = boardQuery.data?.sections ?? [];
  const total = boardQuery.data?.totalKits ?? 0;
  const flat = sections.flatMap((s) =>
    s.kits.map((kit) => ({ kit, stage: stageName(s, locale), stageCode: s.stageCode })),
  );

  const outgoing = flat.filter(({ kit }) => directionForKit(kit.status) === 'outgoing');
  const incoming = flat.filter(({ kit }) => directionForKit(kit.status) === 'incoming');
  const other = flat.filter(({ kit }) => {
    const d = directionForKit(kit.status);
    return d !== 'outgoing' && d !== 'incoming';
  });

  function renderKitRow(
    kit: WipKit,
    stage: string,
    lane: 'outgoing' | 'incoming' | 'other',
  ) {
    const loc =
      kit.location?.name?.trim() || kit.location?.code || tp('hubWipNoBin');
    const custody =
      kit.custody ??
      (kit.status === 'READY'
        ? 'WAITING_PICKUP'
        : kit.status === 'CLAIMED'
          ? 'RECEIVED'
          : kit.status === 'OPEN'
            ? 'AT_STATION'
            : kit.status === 'CONSUMED'
              ? 'IN_USE'
              : null);
    const tone: BoardTone = lane === 'outgoing' ? 'brand' : lane === 'incoming' ? 'info' : 'neutral';
    return (
      <li key={kit.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
        <QrDisplay value={kit.qrCode} size={88} label={tp('kitQr')} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <Stamp tone={tone} size="sm">
              {lane === 'outgoing' ? tp('hubWipOutgoing') : lane === 'incoming' ? tp('hubWipIncoming') : tp('hubWipOther')}
            </Stamp>
            <span className="text-[13px] text-[var(--maher-text-secondary)]">{stage}</span>
          </p>
          <p className="text-[15px] font-semibold text-[var(--maher-text-primary)]" dir="ltr">
            {kit.qrCode}
          </p>
          <p className="text-[12px] text-[var(--maher-text-secondary)]" dir="ltr">
            {tp('hubWipLocation')}: {loc}
            {` · ${kit.pieces.length}/${kit.expectedPieceCount}`}
          </p>
          {custody ? (
            <p className="text-[12px] text-[var(--maher-text-secondary)]">
              {tp('hubWipCustody')}: {custody.replace(/_/g, ' ')}
            </p>
          ) : null}
          {kit.claimedByUser ? (
            <p className="text-[12px] text-[var(--maher-text-secondary)]">
              {tp('hubWipClaimedBy', { name: `${kit.claimedByUser.firstName} ${kit.claimedByUser.lastName}`.trim() })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Stamp tone={kit.status === 'CONSUMED' ? 'success' : kit.status === 'CLAIMED' ? 'info' : kit.status === 'READY' ? 'warning' : 'neutral'} size="sm">
            {kit.status.replace(/_/g, ' ')}
          </Stamp>
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" leadingIcon={<MoveRight className="h-3.5 w-3.5 rtl:-scale-x-100" />} onClick={() => { setTargetBin(kit.location?.id ?? null); setMoving(kit); }}>
              {tp('hubWipMove')}
            </Button>
            <Button size="sm" variant="secondary" leadingIcon={<FileText className="h-3.5 w-3.5" />} onClick={() => openPdf({ path: `/api/v1/inventory/wip-kits/${kit.id}/qr-label`, documentName: kit.qrCode, filename: `${kit.qrCode}.pdf` })}>
              {tp('kitQr')}
            </Button>
          </span>
        </div>
      </li>
    );
  }

  const section = (label: string, items: typeof flat, lane: 'outgoing' | 'incoming' | 'other') =>
    items.length ? (
      <li>
        <p className="border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-5 py-2 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--maher-text-tertiary)] rtl:tracking-normal">{label}</p>
        <ul className="divide-y divide-[var(--maher-border)]">{items.map(({ kit, stage }) => renderKitRow(kit, stage, lane))}</ul>
      </li>
    ) : null;

  return (
    <Board tone="info">
      <Board.Header
        title={tp('hubWip')}
        description={tp('hubWipHint')}
        meta={total > 0 ? <Stamp tone="info" size="sm">{total}</Stamp> : null}
        actions={
          binsQuery.isSuccess && bins.length === 0 ? (
            <Button size="sm" variant="secondary" loading={ensureBins.isPending} onClick={() => ensureBins.mutate()} title={tp('hubWipEnsureBinsHint')}>
              {tp('hubWipEnsureBins')}
            </Button>
          ) : null
        }
      />
      {boardQuery.isLoading ? (
        <BoardSkeleton header={false} rows={3} />
      ) : boardQuery.isError ? (
        <Board.Empty title={tp('hubWipError')} />
      ) : flat.length === 0 ? (
        <Board.Empty title={tp('hubWipEmptyTitle')} description={tp('hubWipEmptyBody')} />
      ) : (
        <ul className="divide-y divide-[var(--maher-border)]">
          {section(tp('hubWipOutgoingSection'), outgoing, 'outgoing')}
          {section(tp('hubWipIncomingSection'), incoming, 'incoming')}
          {section(tp('hubWipOtherSection'), other, 'other')}
        </ul>
      )}
      {pdfDialog}
      <Sheet
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        title={tp('hubWipMoveTitle')}
        description={moving ? <span dir="ltr">{moving.qrCode}</span> : undefined}
        closeLabel={tCommon('close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoving(null)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={moveKit.isPending} disabled={!moving || targetBin === (moving.location?.id ?? null)} onClick={() => moving && moveKit.mutate({ kitId: moving.id, locationId: targetBin })}>
              {tp('hubWipMove')}
            </Button>
          </>
        }
      >
        {bins.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--maher-text-secondary)]">{tp('hubWipEnsureBinsHint')}</p>
            <Button size="sm" variant="secondary" loading={ensureBins.isPending} onClick={() => ensureBins.mutate()}>
              {tp('hubWipEnsureBins')}
            </Button>
          </div>
        ) : (
          <Combobox label={tCommon('bin')} value={targetBin} onChange={setTargetBin} options={bins.map((b) => ({ value: b.id, label: b.name?.trim() || b.code, description: b.code }))} placeholder={tCommon('select')} emptyText={kitCopy.combobox.empty} clearLabel={kitCopy.combobox.clear} />
        )}
      </Sheet>
    </Board>
  );
}
