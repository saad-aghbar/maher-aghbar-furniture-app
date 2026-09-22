'use client';

import { approvalTone, chargeTone, lifecycleTone, mediaSrc, pieceTone, useReturnCopy, type ReturnDetail } from '@/components/returns/return-shared';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Link } from '@/i18n/navigation';
import { ActionDock, Alert, Board, BoardSkeleton, Button, ConfirmDialog, DetailHero, ErrorBoard, Figure, Input, Ledger, LedgerRow, Ltr, Stamp, StageStrip, Ticket, Timeline, type StageStripStage, type TimelineItem } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, ImageOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const JOURNEY = ['REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTING', 'READY_TO_RETURN', 'COMPLETED'] as const;

export default function ReturnDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tl = useTranslations('lifecycle');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const copy = useReturnCopy();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<'sent' | 'accept' | 'reject' | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['customer-return', params.id], queryFn: () => apiFetch<ReturnDetail>(`/api/v1/returns/${params.id}`) });
  const settle = async () => {
    setError(null);
    setConfirm(null);
    await qc.invalidateQueries({ queryKey: ['customer-return', params.id] });
    await qc.invalidateQueries({ queryKey: ['customer-returns'] });
  };
  const markSent = useMutation({ mutationFn: () => apiFetch(`/api/v1/returns/${params.id}/mark-sent`, { method: 'POST', body: '{}' }), onSuccess: settle, onError: (e) => setError(mutationErrorMessage(e)) });
  const respond = useMutation({
    mutationFn: (input: { accept: boolean; note?: string }) => apiFetch(`/api/v1/returns/${params.id}/charge/respond`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: settle,
    onError: (e) => setError(mutationErrorMessage(e)),
  });

  if (query.isLoading && !query.data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={4} />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <ErrorBoard title={t('returns')} description={tCommon('loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }
  const row = query.data;
  const approval = (row.approvalStatus ?? 'PENDING').toUpperCase();
  const lifecycle = (row.lifecycleState ?? 'REQUESTED').toUpperCase();
  const pieces = row.pieces ?? [];
  const awaiting = pieces.filter((p) => p.state === 'AWAITING_RECEIPT');
  const canMarkSent = approval === 'APPROVED' && lifecycle === 'APPROVED' && awaiting.length > 0;
  const chargeStatus = (row.chargeStatus ?? 'NOT_REQUIRED').toUpperCase();
  const awaitingCharge = chargeStatus === 'AWAITING_DEALER';
  const productSrc = mediaSrc(row.productImageUrl);
  const reasonSrc = mediaSrc(row.reasonPhotoUrls?.[0] ?? row.reasonPhotoUrl);
  const issueSrc = mediaSrc(row.issuePhotoUrls?.[0] ?? row.issuePhotoUrl);
  const idx = JOURNEY.indexOf(lifecycle as (typeof JOURNEY)[number]);
  const eff = idx >= 0 ? idx : lifecycle === 'NEED_INFO' ? 0 : ['REWORKING', 'REPLACING'].includes(lifecycle) ? 4 : ['RETURNING', 'RETURNED_TO_STOCK'].includes(lifecycle) ? 5 : -1;
  const terminalBad = lifecycle === 'REJECTED' || lifecycle === 'SCRAPPED';
  const stages: StageStripStage[] = JOURNEY.map((key, i) => ({ key, label: copy.status(key), state: terminalBad ? (i === 0 ? 'done' : 'blocked') : i < eff ? 'done' : i === eff ? 'current' : 'todo' }));
  const heroTone = awaitingCharge ? 'warning' : lifecycleTone(lifecycle);
  const attention = copy.attention(row);
  const timeline: TimelineItem[] = [
    row.createdAt ? { id: 'created', time: copy.date(row.createdAt), title: copy.status('REQUESTED'), description: copy.reason(row.reason), tone: 'info' as const } : null,
    approval === 'APPROVED' || approval === 'REJECTED' ? { id: 'resolved', title: copy.status(approval), tone: approvalTone(approval) } : null,
    row.needInfoNote && approval === 'NEED_INFO' ? { id: 'need', title: tl('returnDetail.needInfo'), description: row.needInfoNote, tone: 'warning' as const } : null,
    row.sentToFactoryAt ? { id: 'sent', time: copy.date(row.sentToFactoryAt), title: copy.status('IN_TRANSIT'), tone: 'info' as const } : null,
    row.receivedAt ? { id: 'received', time: copy.date(row.receivedAt), title: copy.status('RECEIVED'), tone: 'brand' as const } : null,
    row.chargeSentAt ? { id: 'charge', time: copy.date(row.chargeSentAt), title: tl('returnDetail.chargeAmount'), description: copy.money(row.chargeAmount), tone: 'warning' as const } : null,
    row.chargeConfirmedAt ? { id: 'charge-ok', time: copy.date(row.chargeConfirmedAt), title: copy.status('CONFIRMED'), tone: 'success' as const } : null,
    ...(row.reshipDeliveries ?? []).map((d) => ({ id: `reship-${d.id}`, time: d.deliveryDate ? copy.date(d.deliveryDate) : undefined, title: tl('returnDetail.reship'), description: <Ltr>{d.number}</Ltr>, tone: 'success' as const })),
  ].filter(Boolean) as TimelineItem[];

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        tone={heroTone}
        back={{ label: t('returns'), onClick: () => router.push('/dealer/returns') }}
        code={row.number}
        title={row.productDesc}
        subtitle={row.salesOrder ? <Link href={`/dealer/orders/${row.salesOrder.id}`} className="font-medium text-[var(--maher-brand)] hover:underline"><Ltr>{row.salesOrder.number}</Ltr></Link> : undefined}
        status={{ label: copy.status(lifecycle), tone: lifecycleTone(lifecycle) }}
        media={
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--maher-surface-muted)] sm:h-20 sm:w-20">
            {productSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <Armchair className="h-7 w-7 text-[var(--maher-text-tertiary)] opacity-60" />
            )}
          </span>
        }
        facts={[
          { label: tc('quantity'), value: Number(row.quantity), ltr: true },
          { label: tc('reason'), value: copy.reason(row.reason) },
          ...(row.resolution ? [{ label: tl('returnDetail.resolution'), value: tStatus.has(row.resolution as never) ? tStatus(row.resolution as never) : row.resolution, tone: 'info' as const }] : []),
          { label: tl('returnDetail.pieces'), value: row.pieceSummary ? `${row.pieceSummary.returned + row.pieceSummary.recovered}/${row.pieceSummary.total}` : `${pieces.length}`, ltr: true },
          ...(chargeStatus !== 'NOT_REQUIRED' ? [{ label: tl('returnDetail.chargeStatus'), value: copy.chargeStatus(chargeStatus), tone: chargeTone(chargeStatus) }] : []),
        ]}
        primary={canMarkSent ? <Button onClick={() => setConfirm('sent')}>{tl('returnDesk.dealerMarkSent')}</Button> : awaitingCharge ? <Button onClick={() => setConfirm('accept')}>{tl('returnDetail.recordAccept')}</Button> : undefined}
      >
        <StageStrip stages={stages} compact />
      </DetailHero>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {attention ? <Ticket tone="warning" wash title={tl('returnAttention.title')} why={attention} /> : null}
      {row.needInfoNote && approval === 'NEED_INFO' ? <Alert variant="warning">{`${tl('returnDetail.needInfoNote')}: ${row.needInfoNote}`}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          {pieces.length ? (
            <Board tone="neutral">
              <Board.Header title={tl('returnDetail.pieces')} meta={<Stamp tone="neutral" size="sm">{pieces.length}</Stamp>} />
              <Ledger className="px-5 pb-2">
                {pieces.map((piece) => (
                  <LedgerRow key={piece.id} label={<span className="flex items-center gap-2"><Ltr className="font-medium">{piece.code}</Ltr><span className="text-[var(--maher-text-secondary)]">{piece.productDesc}</span></span>} hint={piece.decision ? copy.status(piece.decision) : undefined} value={<Stamp tone={pieceTone(piece.state)} size="sm">{copy.status(piece.state)}</Stamp>} />
                ))}
              </Ledger>
            </Board>
          ) : null}

          {awaitingCharge ? (
            <Board tone="warning" wash="top">
              <Board.Header title={tl('returnDetail.chargeAmount')} description={tl('returnDetail.chargeHint')} meta={<Stamp tone="warning" size="sm">{copy.chargeStatus(chargeStatus)}</Stamp>} />
              <Board.Body className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Figure size="md" value={copy.money(row.chargeAmount)} label={tl('returnDetail.chargeAmount')} tone="warning" />
                  {row.factoryShareAmount ? <Figure size="md" value={copy.money(row.factoryShareAmount)} label={tl('returnDetail.factoryShare')} tone="success" /> : null}
                </div>
                <Input label={tl('returnDetail.rejectionNote')} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
              </Board.Body>
              <Board.Footer>
                <Button onClick={() => setConfirm('accept')}>{tl('returnDetail.recordAccept')}</Button>
                <Button variant="secondary" onClick={() => setConfirm('reject')}>{tl('returnDetail.recordReject')}</Button>
              </Board.Footer>
            </Board>
          ) : null}

          {chargeStatus !== 'NOT_REQUIRED' && !awaitingCharge ? (
            <Board tone={chargeTone(chargeStatus)}>
              <Board.Header title={tl('returnDetail.chargeStatus')} meta={<Stamp tone={chargeTone(chargeStatus)} size="sm">{copy.chargeStatus(chargeStatus)}</Stamp>} />
              <Ledger className="px-5 pb-2">
                <LedgerRow label={tl('returnDetail.chargeAmount')} value={<Ltr>{copy.money(row.chargeAmount)}</Ltr>} />
                {row.chargeInvoices?.[0] ? <LedgerRow label={tl('returnDetail.invoice')} value={<Ltr>{row.chargeInvoices[0].number}</Ltr>} tone="success" stamp href={`/dealer/invoices/${row.chargeInvoices[0].id}`} LinkComponent={Link} /> : null}
                {chargeStatus === 'REJECTED' && row.chargeRejectionNote ? <LedgerRow label={tl('returnDetail.rejectionNote')} value={row.chargeRejectionNote} /> : null}
              </Ledger>
            </Board>
          ) : null}
        </div>

        <div className="space-y-5 xl:col-span-5">
          <Board tone="neutral">
            <Board.Header title={tl('returnDesk.photos')} description={row.description ?? undefined} />
            <Board.Body className="grid grid-cols-2 gap-2">
              {[{ src: reasonSrc, label: tc('reasonPhoto') }, { src: issueSrc, label: tc('issuePhoto') }].map((photo) => (
                <figure key={photo.label} className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-[var(--maher-surface-muted)]">
                  {photo.src ? (
                    <a href={photo.src} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.src} alt={photo.label} className="h-full w-full object-cover" />
                    </a>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--maher-text-tertiary)]">
                      <ImageOff className="h-4 w-4 opacity-50" />
                      <span className="text-[11px]">{tc('noReturnPhoto')}</span>
                    </div>
                  )}
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-5 text-[11px] font-medium text-white">{photo.label}</figcaption>
                </figure>
              ))}
            </Board.Body>
          </Board>
          <Board tone="neutral">
            <Board.Header title={tCommon('history')} />
            <Board.Body>{timeline.length ? <Timeline items={timeline} dense /> : <p className="text-[13px] text-[var(--maher-text-tertiary)]">—</p>}</Board.Body>
          </Board>
        </div>
      </div>

      {canMarkSent || awaitingCharge ? (
        <ActionDock className="md:hidden" note={<Stamp tone={heroTone} size="sm">{copy.status(lifecycle)}</Stamp>}>
          <Button className="flex-1" onClick={() => setConfirm(canMarkSent ? 'sent' : 'accept')}>{canMarkSent ? tl('returnDesk.dealerMarkSent') : tl('returnDetail.recordAccept')}</Button>
        </ActionDock>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm === 'sent' ? tl('returnDesk.dealerMarkSent') : confirm === 'reject' ? tl('returnDetail.recordReject') : tl('returnDetail.recordAccept')}
        description={confirm === 'sent' ? tl('returnDesk.dealerMarkSentConfirm') : confirm === 'reject' ? rejectNote || tl('returnDetail.rejectionNote') : `${tl('returnDetail.chargeAmount')}: ${copy.money(row.chargeAmount)}`}
        confirmLabel={confirm === 'sent' ? tl('returnDesk.dealerMarkSent') : confirm === 'reject' ? tl('returnDetail.recordReject') : tl('returnDetail.recordAccept')}
        cancelLabel={tCommon('cancel')}
        danger={confirm === 'reject'}
        loading={markSent.isPending || respond.isPending}
        error={error}
        onClose={() => !(markSent.isPending || respond.isPending) && setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'sent') markSent.mutate();
          else if (confirm === 'accept') respond.mutate({ accept: true });
          else if (confirm === 'reject') respond.mutate({ accept: false, note: rejectNote.trim() || undefined });
        }}
      />
    </div>
  );
}
