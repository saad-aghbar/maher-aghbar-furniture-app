'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { Link, useRouter } from '@/i18n/navigation';
import {
  ActionDock,
  Alert,
  Board,
  BoardSkeleton,
  Button,
  Checkbox,
  Combobox,
  DetailHero,
  ErrorBoard,
  Figure,
  Input,
  KeyFacts,
  Ledger,
  LedgerRow,
  Ltr,
  Menu,
  Meter,
  MoneyField,
  Ribbon,
  SegmentedControl,
  StageStrip,
  Stamp,
  TextArea,
  Ticket,
  Timeline,
  type StageStripStage,
  type TimelineItem,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { Armchair, ImageOff, MoreHorizontal, Truck, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { approvalTone, chargeTone, lifecycleTone, mediaSrc, pieceTone, useReturnCopy } from './return-shared';
import type { ReturnPiece, ReturnPieceDecision, ReturnResponsibility } from './return-types';
import { RETURN_DECISIONS, RETURN_RESPONSIBILITIES, defaultWorkflowId, useReturnDesk, type ReturnConfirmKind } from './use-return-desk';

const LIFECYCLE_ORDER = ['REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTING', 'REWORKING', 'READY_TO_RETURN', 'RETURNING', 'COMPLETED'] as const;

/** Return desk — the full-page home of one return: review, receive, decide, charge, reship. */
export function ReturnDesk({ id }: { id: string }) {
  const locale = useLocale();
  const t = useTranslations('lifecycle');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const copy = useReturnCopy();
  const router = useRouter();
  const desk = useReturnDesk(id);
  const { detail, form, mutations, busy } = desk;

  const stages = useMemo<StageStripStage[]>(() => {
    const state = (detail?.lifecycleState ?? 'REQUESTED').toUpperCase();
    const terminalBad = state === 'REJECTED' || state === 'SCRAPPED';
    const idx = LIFECYCLE_ORDER.indexOf(state as (typeof LIFECYCLE_ORDER)[number]);
    const effective = idx >= 0 ? idx : state === 'NEED_INFO' ? 0 : state === 'REPLACING' ? 5 : state === 'RETURNED_TO_STOCK' ? 8 : -1;
    const dates: Record<string, string | null | undefined> = {
      REQUESTED: detail?.createdAt,
      IN_TRANSIT: detail?.sentToFactoryAt,
      RECEIVED: detail?.receivedAt,
      INSPECTING: detail?.inspectedAt,
    };
    return LIFECYCLE_ORDER.map((key, i) => ({
      key,
      label: copy.status(key),
      meta: dates[key] ? <Ltr>{copy.date(dates[key])}</Ltr> : undefined,
      state: (terminalBad ? (i === 0 ? 'done' : 'blocked') : i < effective ? 'done' : i === effective ? 'current' : 'todo') as StageStripStage['state'],
    }));
  }, [detail, copy]);

  if (desk.detailQuery.isLoading && !detail) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <BoardSkeleton rows={4} />
            <BoardSkeleton rows={3} />
          </div>
          <div className="space-y-5 xl:col-span-5">
            <BoardSkeleton rows={3} />
            <BoardSkeleton rows={4} />
          </div>
        </div>
      </div>
    );
  }
  if (!detail) {
    return <ErrorBoard title={tNav('returns')} description={tCommon('loadFailed')} onRetry={() => desk.detailQuery.refetch()} retryLabel={tCommon('retry')} />;
  }

  const approval = (detail.approvalStatus ?? 'PENDING').toUpperCase();
  const physical = (detail.physicalStatus ?? 'NONE').toUpperCase();
  const lifecycle = (detail.lifecycleState ?? 'REQUESTED').toUpperCase();
  const pending = approval === 'PENDING' || approval === 'NEED_INFO';
  const pieces = detail.pieces ?? [];
  const awaiting = pieces.filter((piece) => piece.state === 'AWAITING_RECEIPT');
  const receivable = awaiting.length > 0 || (approval === 'APPROVED' && physical === 'WAITING_RETURN');
  const canMarkSent = approval === 'APPROVED' && lifecycle === 'APPROVED' && awaiting.length > 0;
  const undecided = pieces.filter((piece) => piece.state === 'RECEIVED' && !piece.decision);
  const inWork = pieces.filter((piece) => piece.state === 'DECIDED' || piece.state === 'IN_PROGRESS');
  const readyPieces = pieces.filter((piece) => piece.state === 'READY_TO_RETURN');
  const closed = lifecycle === 'COMPLETED' || lifecycle === 'REJECTED' || lifecycle === 'SCRAPPED' || lifecycle === 'RETURNED_TO_STOCK';
  const invoice = detail.chargeInvoices?.[0];
  const customerLabel = detail.customer ? localizedName(locale, detail.customer, detail.customer.name) : '—';
  const productSrc = mediaSrc(detail.productImageUrl);
  const reasonPhotos = (detail.reasonPhotoUrls?.length ? detail.reasonPhotoUrls : detail.reasonPhotoUrl ? [detail.reasonPhotoUrl] : []).map(mediaSrc).filter(Boolean) as string[];
  const issuePhotos = (detail.issuePhotoUrls?.length ? detail.issuePhotoUrls : detail.issuePhotoUrl ? [detail.issuePhotoUrl] : []).map(mediaSrc).filter(Boolean) as string[];
  const actualCost = Number(detail.reworkCost?.actualTotal || 0);
  const estimatedCost = Number(detail.reworkCost?.estimatedTotal || 0);
  const productionCost = actualCost > 0 ? actualCost : estimatedCost > 0 ? estimatedCost : null;
  const chargeStatus = String(detail.chargeStatus ?? 'NOT_REQUIRED').toUpperCase();
  const chargeLocked = chargeStatus === 'INVOICED';
  const attention = copy.attention(detail);
  const heroTone = closed ? lifecycleTone(lifecycle) : attention ? 'warning' : lifecycleTone(lifecycle);
  const summary = detail.pieceSummary;
  const activeWarehouse = desk.warehouses.find((w) => w.id === form.warehouseId);
  const bins = (activeWarehouse?.locations ?? []).filter((loc) => loc.isActive !== false);

  const timeline: TimelineItem[] = [
    detail.createdAt ? { id: 'created', time: copy.date(detail.createdAt), title: copy.status('REQUESTED'), description: copy.reason(detail.reason), tone: 'info' as const } : null,
    detail.needInfoNote && approval === 'NEED_INFO' ? { id: 'need-info', title: t('returnDetail.needInfo'), description: detail.needInfoNote, tone: 'warning' as const } : null,
    approval === 'APPROVED' || approval === 'REJECTED' ? { id: 'resolved', title: copy.status(approval), tone: approvalTone(approval) } : null,
    detail.sentToFactoryAt ? { id: 'sent', time: copy.date(detail.sentToFactoryAt), title: copy.status('IN_TRANSIT'), tone: 'info' as const } : null,
    detail.collectedAt ? { id: 'collected', time: copy.date(detail.collectedAt), title: t('returnDetail.reship'), tone: 'info' as const } : null,
    detail.receivedAt
      ? {
          id: 'received',
          time: copy.date(detail.receivedAt),
          title: t('returnDetail.confirmReturnedToFactory'),
          description: [detail.receivedCondition, detail.receivedLocation?.code, detail.receivedNotes].filter(Boolean).join(' · ') || undefined,
          tone: 'brand' as const,
        }
      : null,
    detail.inspectedAt ? { id: 'inspected', time: copy.date(detail.inspectedAt), title: copy.status('INSPECTING'), description: detail.pieces?.find((p) => p.inspectionNotes)?.inspectionNotes ?? undefined, tone: 'brand' as const } : null,
    detail.chargeSentAt ? { id: 'charge-sent', time: copy.date(detail.chargeSentAt), title: t('returnDetail.sendToDealer'), description: copy.money(detail.chargeAmount), tone: 'warning' as const } : null,
    detail.chargeConfirmedAt ? { id: 'charge-ok', time: copy.date(detail.chargeConfirmedAt), title: t('returnDetail.recordAccept'), tone: 'success' as const } : null,
    detail.chargeRejectedAt ? { id: 'charge-no', time: copy.date(detail.chargeRejectedAt), title: t('returnDetail.recordReject'), description: detail.chargeRejectionNote ?? undefined, tone: 'error' as const } : null,
    ...(detail.reshipDeliveries ?? []).map((d) => ({
      id: `reship-${d.id}`,
      time: d.deliveryDate ? copy.date(d.deliveryDate) : undefined,
      title: t('returnDetail.reship'),
      description: <Link href={`/admin/deliveries/${d.id}`} className="font-medium text-[var(--maher-brand)] hover:underline"><Ltr>{d.number}</Ltr></Link>,
      tone: 'success' as const,
    })),
    invoice ? { id: 'invoice', title: t('returnDetail.invoice'), description: <Link href={`/admin/invoices/${invoice.id}`} className="font-medium text-[var(--maher-brand)] hover:underline"><Ltr>{invoice.number}</Ltr></Link>, tone: 'success' as const } : null,
  ].filter(Boolean) as TimelineItem[];

  const confirmCopy: Record<ReturnConfirmKind, { title: string; description: string; confirm: string; danger?: boolean; run: () => void; loading: boolean }> = {
    approve: { title: tCommon('approve'), description: t('returnDetail.approveConfirm'), confirm: tCommon('approve'), run: () => mutations.resolve.mutate('APPROVED'), loading: mutations.resolve.isPending },
    reject: { title: tCommon('reject'), description: t('returnDetail.rejectConfirm'), confirm: tCommon('reject'), danger: true, run: () => mutations.resolve.mutate('REJECTED'), loading: mutations.resolve.isPending },
    need_info: { title: t('returnDetail.needInfo'), description: t('returnDetail.needInfoConfirm'), confirm: t('returnDetail.needInfo'), run: () => mutations.needInfo.mutate(), loading: mutations.needInfo.isPending },
    mark_sent: { title: t('returnDesk.markSent'), description: t('returnDesk.markSentConfirm'), confirm: t('returnDesk.markSent'), run: () => mutations.markSent.mutate(), loading: mutations.markSent.isPending },
    receive: { title: t('returnDetail.confirmReturnedToFactory'), description: t('returnDetail.receiveConfirm'), confirm: t('returnDetail.receivePieces'), run: () => mutations.receive.mutate(), loading: mutations.receive.isPending },
    decide: { title: t('returnDetail.decision'), description: `${Object.keys(form.decisions).length} · ${t('returnDetail.pieces')}`, confirm: t('returnDetail.decision'), run: () => mutations.decide.mutate(), loading: mutations.decide.isPending },
    charge: { title: t('returnDetail.charge'), description: `${t('returnDetail.chargeAmount')}: ${copy.money(form.chargeAmount || detail.chargeAmount)}`, confirm: t('returnDetail.charge'), run: () => mutations.charge.mutate(), loading: mutations.charge.isPending },
    send_charge: { title: t('returnDetail.sendToDealer'), description: `${t('returnDetail.chargeAmount')}: ${copy.money(form.chargeAmount || detail.chargeAmount)}`, confirm: t('returnDetail.sendToDealer'), run: () => mutations.sendCharge.mutate(), loading: mutations.sendCharge.isPending },
    accept_charge: { title: t('returnDetail.recordAccept'), description: t('returnDetail.factoryOverrideHint'), confirm: t('returnDetail.recordAccept'), run: () => mutations.respondCharge.mutate({ accept: true }), loading: mutations.respondCharge.isPending },
    reject_charge: { title: t('returnDetail.recordReject'), description: form.rejectNote.trim() || t('returnDetail.rejectionNote'), confirm: t('returnDetail.recordReject'), danger: true, run: () => mutations.respondCharge.mutate({ accept: false, note: form.rejectNote.trim() }), loading: mutations.respondCharge.isPending },
    reship: { title: t('returnDetail.reship'), description: form.reshipAddress.trim() || t('returnDetail.reshipAddress'), confirm: t('returnDetail.reship'), run: () => mutations.reship.mutate(), loading: mutations.reship.isPending },
    ready: { title: t('returnDetail.ready'), description: `${readyPieces.length + inWork.length} · ${t('returnDetail.pieces')}`, confirm: t('returnDetail.ready'), run: () => mutations.ready.mutate(), loading: mutations.ready.isPending },
    cancel: { title: t('returnDetail.cancel'), description: t('returnDetail.cancel'), confirm: t('returnDetail.cancel'), danger: true, run: () => mutations.cancel.mutate(), loading: mutations.cancel.isPending },
  };
  const active = desk.confirm ? confirmCopy[desk.confirm] : null;

  // The one primary answer for the dock, by state.
  const primary = pending
    ? { label: tCommon('approve'), kind: 'approve' as const }
    : canMarkSent
      ? { label: t('returnDesk.markSent'), kind: 'mark_sent' as const }
      : receivable
        ? { label: t('returnDetail.receivePieces'), kind: 'receive' as const }
        : undecided.length
          ? { label: t('returnDetail.decision'), kind: 'decide' as const, disabled: !Object.keys(form.decisions).length }
          : inWork.length
            ? { label: t('returnDetail.ready'), kind: 'ready' as const }
            : readyPieces.length
              ? { label: t('returnDetail.reship'), kind: 'reship' as const }
              : null;

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        tone={heroTone}
        back={{ label: tNav('returns'), onClick: () => router.push('/admin/returns') }}
        code={detail.number}
        title={detail.productDesc}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{customerLabel}</span>
            {detail.salesOrder ? (
              <>
                <span className="text-[var(--maher-text-tertiary)]">·</span>
                <Link href={`/admin/sales-orders/${detail.salesOrder.id}`} className="font-medium text-[var(--maher-brand)] hover:underline">
                  <Ltr>{detail.salesOrder.number}</Ltr>
                </Link>
                {detail.salesOrder.externalOrderNumber ? <Ltr className="text-[var(--maher-text-tertiary)]">{detail.salesOrder.externalOrderNumber}</Ltr> : null}
              </>
            ) : null}
          </span>
        }
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
          { label: tc('qty'), value: Number(detail.quantity), ltr: true },
          { label: tc('reason'), value: copy.reason(detail.reason) },
          { label: t('returnDetail.pieces'), value: summary ? t('returnDesk.piecesDone', { done: summary.returned + summary.recovered, total: summary.total }) : copy.physical(physical) },
          { label: t('returnDetail.chargeStatus'), value: copy.chargeStatus(chargeStatus), tone: chargeTone(chargeStatus) },
          ...(productionCost != null ? [{ label: t('returnDetail.productionCost'), value: copy.money(productionCost), ltr: true }] : []),
        ]}
        primary={primary ? <Button disabled={busy || primary.disabled} onClick={() => desk.setConfirm(primary.kind)}>{primary.label}</Button> : undefined}
        actions={
          !closed ? (
            <Menu
              aria-label={tCommon('actions')}
              trigger={<Button variant="secondary" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>}
              items={[
                ...(pending ? [{ id: 'reject', label: tCommon('reject'), icon: <XCircle className="h-4 w-4" />, tone: 'error' as const, onSelect: () => desk.setConfirm('reject') }] : []),
                ...(!pending && !readyPieces.length && inWork.length === 0 && pieces.length > 0 ? [{ id: 'ready', label: t('returnDetail.ready'), icon: <Truck className="h-4 w-4" />, onSelect: () => desk.setConfirm('ready') }] : []),
                ...(!pending && readyPieces.length ? [{ id: 'reship', label: t('returnDetail.reship'), icon: <Truck className="h-4 w-4" />, onSelect: () => desk.setConfirm('reship') }] : []),
                { id: 'cancel', label: t('returnDetail.cancel'), icon: <XCircle className="h-4 w-4" />, tone: 'error' as const, separator: true, onSelect: () => desk.setConfirm('cancel') },
              ]}
            />
          ) : undefined
        }
      >
        <StageStrip stages={stages} compact />
      </DetailHero>

      {desk.error ? <Alert variant="error">{desk.error}</Alert> : null}
      {attention ? (
        <Ticket tone="warning" wash title={t('returnAttention.title')} why={attention} trailing={detail.needInfoNote && approval === 'NEED_INFO' ? <Stamp tone="warning" size="sm">{t('returnDetail.needInfo')}</Stamp> : undefined} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          {pending ? (
            <Board tone="warning" wash="top">
              <Board.Header title={t('returnAttention.pendingReview')} description={t('returnDetail.approveDoesNotReceive')} />
              <Board.Body className="space-y-3">
                {detail.description ? <p className="text-[14px] leading-6 text-[var(--maher-text-secondary)]">{detail.description}</p> : null}
                <TextArea label={t('returnDetail.needInfoNote')} value={form.needInfoNote} onChange={(e) => form.setNeedInfoNote(e.target.value)} rows={3} placeholder={t('returnDetail.needInfoNotePlaceholder')} />
              </Board.Body>
              <Board.Footer>
                <Button disabled={busy} onClick={() => desk.setConfirm('approve')}>{tCommon('approve')}</Button>
                <Button variant="secondary" disabled={busy || !form.needInfoNote.trim()} onClick={() => desk.setConfirm('need_info')}>{t('returnDetail.needInfo')}</Button>
                <Button variant="ghost" disabled={busy} onClick={() => desk.setConfirm('reject')}>{tCommon('reject')}</Button>
              </Board.Footer>
            </Board>
          ) : null}

          {pieces.length ? (
            <Board tone={undecided.length ? 'brand' : 'neutral'}>
              <Board.Header
                title={t('returnDetail.pieces')}
                description={summary ? `${summary.returned + summary.recovered}/${summary.total}` : `${pieces.length}`}
                meta={
                  summary ? (
                    <div className="hidden w-48 sm:block">
                      <Ribbon
                        size="sm"
                        legend={false}
                        segments={[
                          { key: 'awaiting', label: copy.status('AWAITING_RECEIPT'), value: summary.awaitingReceipt, tone: 'warning' },
                          { key: 'received', label: copy.status('RECEIVED'), value: summary.received + summary.decided, tone: 'brand' },
                          { key: 'progress', label: copy.status('IN_PROGRESS'), value: summary.inProgress, tone: 'info' },
                          { key: 'ready', label: copy.status('READY_TO_RETURN'), value: summary.readyToReturn + summary.returning, tone: 'success' },
                          { key: 'done', label: copy.status('RETURNED'), value: summary.returned + summary.recovered, tone: 'success' },
                          { key: 'cancelled', label: copy.status('CANCELLED'), value: summary.cancelled, tone: 'error' },
                        ]}
                      />
                    </div>
                  ) : undefined
                }
              />
              <ul className="divide-y divide-[var(--maher-border)]">
                {pieces.map((piece) => (
                  <PieceRow
                    key={piece.id}
                    piece={piece}
                    draft={form.decisions[piece.id]}
                    onDraft={(next) => form.setDecisions((current) => ({ ...current, [piece.id]: next }))}
                    workflows={desk.workflows}
                    onCancel={!closed && piece.state !== 'CANCELLED' && piece.state !== 'RETURNED' && piece.state !== 'RECOVERED' ? () => mutations.cancelPiece.mutate(piece.id) : undefined}
                    statusLabel={copy.status(piece.state)}
                    decisionLabel={piece.decision ? copy.status(piece.decision) : null}
                    busy={busy}
                  />
                ))}
              </ul>
              {undecided.length ? (
                <Board.Footer>
                  <Button disabled={busy || !Object.keys(form.decisions).length} onClick={() => desk.setConfirm('decide')}>
                    {t('returnDetail.decision')}
                  </Button>
                  <span className="text-[12px] text-[var(--maher-text-tertiary)]">{`${Object.keys(form.decisions).length}/${undecided.length}`}</span>
                </Board.Footer>
              ) : null}
            </Board>
          ) : null}

          {receivable && !closed ? (
            <Board tone="info" wash="top">
              <Board.Header title={t('returnDetail.confirmReturnedToFactory')} description={t('returnDetail.receiveHint')} meta={canMarkSent ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => desk.setConfirm('mark_sent')}>{t('returnDesk.markSent')}</Button> : undefined} />
              <Board.Body className="space-y-4">
                {awaiting.length ? (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {awaiting.map((piece) => (
                      <Checkbox
                        key={piece.id}
                        className="rounded-[12px] border border-[var(--maher-border)] px-3 py-2"
                        checked={form.selectedPieceIds.includes(piece.id)}
                        onChange={(checked) => form.setSelectedPieceIds((current) => (checked ? [...current, piece.id] : current.filter((pid) => pid !== piece.id)))}
                        label={<span className="flex items-center gap-2"><Ltr className="font-medium">{piece.code}</Ltr><span className="truncate text-[var(--maher-text-secondary)]">{piece.productDesc}</span></span>}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  <SegmentedControl
                    fill
                    value={form.condition}
                    onChange={form.setCondition}
                    options={[
                      { value: 'GOOD', label: tCommon('good') },
                      { value: 'DAMAGED', label: tCommon('damaged') },
                      { value: 'INCOMPLETE', label: tCommon('incomplete') },
                    ]}
                  />
                  <Combobox<string>
                    label={t('returnDetail.warehouse')}
                    value={form.warehouseId || null}
                    placeholder={tCommon('select')}
                    options={desk.warehouses.map((w) => ({ value: w.id, label: w.nameEn || w.nameAr || w.code, description: w.code }))}
                    onChange={(value) => {
                      form.setWarehouseId(value ?? '');
                      const next = desk.warehouses.find((w) => w.id === value)?.locations?.filter((loc) => loc.isActive !== false);
                      form.setReceivedLocationId(next?.find((loc) => loc.isDefault)?.id ?? next?.[0]?.id ?? '');
                    }}
                  />
                  <Combobox<string>
                    label={t('returnDetail.bin')}
                    value={form.receivedLocationId || null}
                    disabled={!form.warehouseId}
                    placeholder={tCommon('select')}
                    options={bins.map((loc) => ({ value: loc.id, label: loc.code, description: loc.name ?? undefined }))}
                    onChange={(value) => form.setReceivedLocationId(value ?? '')}
                  />
                </div>
                <TextArea label={tCommon('notes')} value={form.receiveNotes} onChange={(e) => form.setReceiveNotes(e.target.value)} rows={2} />
              </Board.Body>
              <Board.Footer>
                <Button disabled={busy || (awaiting.length > 0 && form.selectedPieceIds.length === 0)} loading={mutations.receive.isPending} onClick={() => desk.setConfirm('receive')}>
                  {t('returnDetail.receivePieces')}
                </Button>
              </Board.Footer>
            </Board>
          ) : null}

          {pieces.some((piece) => (piece.recoveryLines ?? []).length > 0) ? (
            <Board tone="info">
              <Board.Header title={t('returnDetail.recovery')} />
              <Ledger className="px-5 pb-2">
                {pieces.flatMap((piece) =>
                  (piece.recoveryLines ?? []).map((line) => (
                    <LedgerRow
                      key={line.id}
                      label={<span className="flex items-center gap-2"><Ltr className="text-[var(--maher-text-tertiary)]">{piece.code}</Ltr><span>{line.label}</span></span>}
                      value={<Ltr>{`${line.quantity} ${line.unit}`}</Ltr>}
                      hint={line.postedAt ? copy.date(line.postedAt) : undefined}
                      tone={line.postedAt ? 'success' : 'neutral'}
                      stamp
                      icon={<Stamp tone={line.postedAt ? 'success' : 'neutral'} size="sm">{copy.status(line.outcome)}</Stamp>}
                    />
                  )),
                )}
              </Ledger>
            </Board>
          ) : null}

          {!pending && !closed && (readyPieces.length > 0 || inWork.length > 0 || physical === 'RETURNED' || physical === 'INSPECTING') ? (
            <Board tone="success">
              <Board.Header title={t('returnDetail.reship')} description={`${readyPieces.length}/${pieces.length || 1}`} />
              <Board.Body className="grid gap-3 sm:grid-cols-2">
                <Input label={t('returnDetail.reshipAddress')} value={form.reshipAddress} onChange={(e) => form.setReshipAddress(e.target.value)} />
                <TextArea label={t('returnDetail.reshipNotes')} value={form.reshipNotes} onChange={(e) => form.setReshipNotes(e.target.value)} rows={2} />
              </Board.Body>
              <Board.Footer>
                {inWork.length ? (
                  <Button variant="secondary" disabled={busy} onClick={() => desk.setConfirm('ready')}>{t('returnDetail.ready')}</Button>
                ) : null}
                <Button disabled={busy || !readyPieces.length} onClick={() => desk.setConfirm('reship')}>{t('returnDetail.reship')}</Button>
              </Board.Footer>
            </Board>
          ) : null}
        </div>

        <div className="space-y-5 xl:col-span-5">
          <Board tone="neutral">
            <Board.Header title={t('returnDesk.photos')} description={detail.description ?? undefined} />
            <Board.Body className="grid grid-cols-2 gap-2">
              <PhotoBlock srcs={reasonPhotos} label={tc('reasonPhoto')} empty={tc('noReturnPhoto')} />
              <PhotoBlock srcs={issuePhotos} label={tc('issuePhoto')} empty={tc('noReturnPhoto')} />
            </Board.Body>
            <KeyFacts
              className="px-5 pb-5"
              facts={[
                { label: tSales('systemOrderNumber'), value: detail.salesOrder ? <Link href={`/admin/sales-orders/${detail.salesOrder.id}`} className="font-medium text-[var(--maher-brand)] hover:underline"><Ltr>{detail.salesOrder.number}</Ltr></Link> : '—', ltr: true },
                { label: tSales('dealerOrderNumber'), value: detail.salesOrder?.externalOrderNumber ?? '—', ltr: true },
                { label: tNav('dealers'), value: detail.customer?.id ? <Link href={`/admin/customers/${detail.customer.id}`} className="font-medium text-[var(--maher-brand)] hover:underline">{customerLabel}</Link> : customerLabel },
                { label: t('returnDetail.resolution'), value: detail.inventoryFate && detail.inventoryFate !== 'PENDING' ? copy.status(detail.inventoryFate) : detail.resolution ? copy.status(detail.resolution) : '—' },
              ]}
            />
          </Board>

          <Board tone={chargeTone(chargeStatus)} wash={chargeStatus === 'AWAITING_DEALER' ? 'top' : 'none'}>
            <Board.Header title={t('returnDetail.responsibility')} description={t('returnDetail.chargeHint')} meta={<Stamp tone={chargeTone(chargeStatus)} size="sm">{copy.chargeStatus(chargeStatus)}</Stamp>} />
            <Board.Body className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Figure size="sm" value={productionCost != null ? copy.money(productionCost) : t('returnDetail.productionCostUnknown')} label={t('returnDetail.productionCost')} locale={locale} />
                <Figure size="sm" value={copy.money(form.chargeAmount || detail.chargeAmount || 0)} label={t('returnDetail.chargeAmount')} tone={chargeTone(chargeStatus)} locale={locale} />
              </div>
              {productionCost != null && Number(form.chargeAmount || detail.chargeAmount || 0) > 0 ? (
                <Meter value={Math.min(Number(form.chargeAmount || detail.chargeAmount || 0), productionCost)} max={productionCost} tone={chargeTone(chargeStatus)} label={t('returnDetail.chargeAmount')} valueLabel={`${Math.round((Number(form.chargeAmount || detail.chargeAmount || 0) / productionCost) * 100)}%`} />
              ) : null}
              <SegmentedControl<ReturnResponsibility>
                fill
                size="sm"
                value={form.responsibility}
                onChange={form.setResponsibility}
                options={RETURN_RESPONSIBILITIES.map((option) => ({ value: option, label: t(`returnDetail.responsibilityOption.${option}`), disabled: chargeLocked }))}
              />
              {form.responsibility === 'FACTORY_WARRANTY' ? <p className="text-[13px] text-[var(--maher-success)]">{t('returnDetail.factoryAbsorbs')}</p> : null}
              {form.responsibility !== 'FACTORY_WARRANTY' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <MoneyField
                    currency="ILS"
                    label={form.responsibility === 'UNDETERMINED' ? t('returnDetail.pendingAgreement') : t('returnDetail.chargeAmount')}
                    value={form.chargeAmount === '' ? null : Number(form.chargeAmount)}
                    onChange={(value) => form.setChargeAmount(value == null ? '' : String(value))}
                    disabled={chargeLocked}
                    min={0}
                    step={50}
                  />
                  {form.responsibility === 'SHARED' ? (
                    <MoneyField currency="ILS" label={t('returnDetail.factoryShare')} value={form.factoryShare === '' ? null : Number(form.factoryShare)} onChange={(value) => form.setFactoryShare(value == null ? '' : String(value))} disabled={chargeLocked} min={0} step={50} />
                  ) : null}
                </div>
              ) : null}
              {chargeStatus === 'REJECTED' && detail.chargeRejectionNote ? <Alert variant="warning">{`${t('returnDetail.rejectionNote')}: ${detail.chargeRejectionNote}`}</Alert> : null}
              {chargeStatus === 'AWAITING_DEALER' ? (
                <div className="space-y-2 rounded-[12px] border border-dashed border-[var(--maher-border)] p-3">
                  <p className="text-[12px] text-[var(--maher-text-tertiary)]">{t('returnDetail.factoryOverrideHint')}</p>
                  <Input label={t('returnDetail.rejectionNote')} value={form.rejectNote} onChange={(e) => form.setRejectNote(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy} onClick={() => desk.setConfirm('accept_charge')}>{t('returnDetail.recordAccept')}</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => desk.setConfirm('reject_charge')}>{t('returnDetail.recordReject')}</Button>
                  </div>
                </div>
              ) : null}
              {invoice ? (
                <Ledger>
                  <LedgerRow label={t('returnDetail.invoice')} value={<Ltr>{invoice.number}</Ltr>} hint={invoice.total != null ? copy.money(invoice.total) : undefined} tone="success" stamp href={`/admin/invoices/${invoice.id}`} LinkComponent={Link} />
                </Ledger>
              ) : null}
            </Board.Body>
            {!chargeLocked ? (
              <Board.Footer>
                <Button variant="secondary" disabled={busy} loading={mutations.responsibility.isPending} onClick={() => mutations.responsibility.mutate()}>{tCommon('save')}</Button>
                {chargeStatus === 'DRAFT' ? <Button disabled={busy} onClick={() => desk.setConfirm('send_charge')}>{t('returnDetail.sendToDealer')}</Button> : null}
                {chargeStatus === 'CONFIRMED' && !invoice ? <Button disabled={busy} onClick={() => desk.setConfirm('charge')}>{t('returnDetail.charge')}</Button> : null}
              </Board.Footer>
            ) : null}
          </Board>

          {(detail.workOrders ?? []).length ? (
            <Board tone="brand">
              <Board.Header title={t('returnDesk.linkedWork')} />
              <Ledger className="px-5 pb-2">
                {(detail.workOrders ?? []).map((wo) => (
                  <LedgerRow key={wo.id} label={<Ltr>{wo.number}</Ltr>} value={<Stamp tone={wo.status === 'COMPLETED' ? 'success' : 'brand'} size="sm">{copy.status(wo.status)}</Stamp>} hint={wo.originType ? copy.status(wo.originType) : undefined} href={`/admin/production/${wo.id}`} LinkComponent={Link} />
                ))}
              </Ledger>
            </Board>
          ) : null}

          <Board tone="neutral">
            <Board.Header title={tCommon('history')} />
            <Board.Body>
              {timeline.length ? <Timeline items={timeline} dense /> : <p className="text-[13px] text-[var(--maher-text-tertiary)]">—</p>}
            </Board.Body>
          </Board>
        </div>
      </div>

      {primary ? (
        <ActionDock className="md:hidden" note={<Stamp tone={heroTone} size="sm">{copy.status(lifecycle)}</Stamp>}>
          <Button className="flex-1" disabled={busy || primary.disabled} onClick={() => desk.setConfirm(primary.kind)}>{primary.label}</Button>
        </ActionDock>
      ) : null}

      <ConfirmDialog
        open={Boolean(active)}
        title={active?.title ?? ''}
        description={active?.description ?? ''}
        confirmLabel={active?.confirm}
        danger={active?.danger}
        loading={active?.loading}
        error={desk.error}
        onClose={() => !busy && desk.setConfirm(null)}
        onConfirm={() => active?.run()}
      />
    </div>
  );
}

function PieceRow({
  piece,
  draft,
  onDraft,
  workflows,
  onCancel,
  statusLabel,
  decisionLabel,
  busy,
}: {
  piece: ReturnPiece;
  draft?: { decision: ReturnPieceDecision; workflowId?: string };
  onDraft: (next: { decision: ReturnPieceDecision; workflowId?: string }) => void;
  workflows: ReturnType<typeof useReturnDesk>['workflows'];
  onCancel?: () => void;
  statusLabel: string;
  decisionLabel: string | null;
  busy: boolean;
}) {
  const t = useTranslations('lifecycle');
  const tCommon = useTranslations('common');
  const decidable = piece.state === 'RECEIVED' && !piece.decision;
  return (
    <li className="space-y-2 px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Stamp tone={pieceTone(piece.state)} size="sm">{statusLabel}</Stamp>
          <Ltr className="text-[13px] font-semibold text-[var(--maher-text-primary)]">{piece.code}</Ltr>
          <span className="truncate text-[13px] text-[var(--maher-text-secondary)]">{piece.productDesc}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {decisionLabel ? <Stamp tone="brand" size="sm">{decisionLabel}</Stamp> : null}
          {piece.productionOrder ? (
            <Link href={`/admin/production/${piece.productionOrder.id}`} className="text-[12px] font-medium text-[var(--maher-brand)] hover:underline"><Ltr>{piece.productionOrder.number}</Ltr></Link>
          ) : null}
          {piece.recoveryOrder ? (
            <Link href={`/admin/production/${piece.recoveryOrder.id}`} className="text-[12px] font-medium text-[var(--maher-brand)] hover:underline">{t('returnDetail.recoveryWorkOrder')}: <Ltr>{piece.recoveryOrder.number}</Ltr></Link>
          ) : null}
          {onCancel ? (
            <Menu
              aria-label={tCommon('actions')}
              trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')} disabled={busy}><MoreHorizontal className="h-4 w-4" /></Button>}
              items={[{ id: 'cancel', label: t('returnDetail.cancelPiece'), icon: <XCircle className="h-4 w-4" />, tone: 'error' as const, onSelect: onCancel }]}
            />
          ) : null}
        </span>
      </div>
      {piece.receivedCondition || piece.inspectionNotes ? (
        <p className="text-[12px] text-[var(--maher-text-tertiary)]">{[piece.receivedCondition, piece.inspectionNotes].filter(Boolean).join(' · ')}</p>
      ) : null}
      {piece.state === 'RECOVERED' ? <p className="text-[12px] text-[var(--maher-text-tertiary)]">{t('returnDetail.quarantineWrittenOff')}</p> : null}
      {decidable ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SegmentedControl<ReturnPieceDecision | ''>
            fill
            size="sm"
            value={draft?.decision ?? ''}
            onChange={(decision) => {
              if (!decision) return;
              onDraft({ decision, workflowId: defaultWorkflowId(decision, workflows) });
            }}
            options={RETURN_DECISIONS.map((decision) => ({ value: decision, label: decision === 'REPAIR' ? t('returnDesk.decisionRepair') : decision === 'REPLACEMENT' ? t('returnDesk.decisionReplacement') : t('returnDesk.decisionRecovery') }))}
          />
          <Combobox<string>
            value={draft?.workflowId ?? null}
            disabled={!draft?.decision}
            placeholder={t('returnDetail.workflow')}
            options={workflows.map((workflow) => ({ value: workflow.id, label: workflow.nameEn || workflow.code, description: workflow.code }))}
            onChange={(value) => {
              if (!draft) return;
              onDraft({ ...draft, workflowId: value ?? undefined });
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

function PhotoBlock({ srcs, label, empty }: { srcs: string[]; label: string; empty: string }) {
  const [first, ...rest] = srcs;
  return (
    <figure className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-[var(--maher-surface-muted)]">
      {first ? (
        <a href={first} target="_blank" rel="noreferrer" className="block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first} alt={label} className="h-full w-full object-cover" />
        </a>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-[var(--maher-text-tertiary)]">
          <ImageOff className="h-4 w-4 opacity-50" />
          <span className="text-center text-[11px] leading-tight">{empty}</span>
        </div>
      )}
      <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-5 text-[11px] font-medium text-white">
        <span>{label}</span>
        {rest.length ? <span>+{rest.length}</span> : null}
      </figcaption>
    </figure>
  );
}
