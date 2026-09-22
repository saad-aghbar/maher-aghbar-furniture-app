'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { fabricEffectiveState, fabricTone, type FabricJob } from '@/components/purchasing/fabric-shared';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Board, BoardSkeleton, Button, DetailHero, ErrorBoard, Ledger, LedgerRow, Ltr, Meter, QrDisplay, Stamp } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Fabric bundle — what a scanned bundle QR resolves to: the dealer fabric job
 * behind it, its order, where it sits and how much is left. Mirrors the mobile
 * scan result screen.
 */
export default function FabricBundlePage({ params }: { params: { code: string } }) {
  const ti = useTranslations('inventory');
  const tp = useTranslations('purchasing');
  const tf = useTranslations('mobile.fabricStatus');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const { openPdf, pdfDialog } = usePdfDownload();
  const code = decodeURIComponent(params.code);
  const query = useQuery({
    queryKey: ['fabric-bundle', code],
    queryFn: () => apiFetch<FabricJob>(`/api/v1/fabric-procurements/by-code/${encodeURIComponent(code)}`),
    retry: false,
  });

  if (query.isLoading) return <BoardSkeleton rows={5} />;
  if (query.isError || !query.data) {
    return <ErrorBoard title={ti('fabricBundle')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }
  const job = query.data;
  const lot = (job.lots ?? []).find((l) => (l.qrCode ?? '').toUpperCase() === code.toUpperCase()) ?? job.lots?.[0] ?? null;
  const state = fabricEffectiveState(job);
  const readiness = typeof job.readiness === 'object' && job.readiness ? job.readiness : null;
  const expected = job.requiredQty ?? null;
  const arrived = job.arrivedQty ?? 0;
  const stateLabel = (() => {
    const map: Record<string, string> = { NEEDS_ORDERING: 'needsOrdering', REQUESTED: 'waitingSupplier', SENT: 'waitingSupplier', SUPPLIER_CONFIRMED: 'waitingSupplier', READY_FOR_PICKUP: 'readyForPickup', ARRIVED: 'inHolding', RECEIVED: 'inHolding', READY_FOR_PRODUCTION: 'ready', ISSUED: 'taken', PARTIAL: 'partial', UNAVAILABLE: 'unavailable' };
    const k = map[state];
    if (k && tf.has(k as never)) return tf(k as never);
    return state.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  })();
  const lotStatus = lot?.status ? (tStatus.has(lot.status as never) ? tStatus(lot.status as never) : lot.status.replace(/_/g, ' ')) : null;

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        back={{ label: tp('fabricJobs'), href: '/admin/purchasing/fabric' }}
        LinkComponent={Link}
        code={<Ltr>{code}</Ltr>}
        title={job.requestedLabel ?? job.sku ?? ti('fabricBundle')}
        subtitle={[job.productName, job.dealerName].filter(Boolean).join(' · ') || undefined}
        status={{ label: stateLabel, tone: fabricTone(state) }}
        media={<InventoryItemThumb src={job.imageUrl ?? job.productImageUrl} alt="" size={88} />}
        facts={[
          { label: tp('salesOrder'), value: job.salesOrderNumber ?? '—', ltr: true },
          { label: ti('sku'), value: job.sku ?? '—', ltr: true },
          { label: ti('remaining'), value: lot ? `${lot.remainingQty ?? lot.quantity} ${job.unit ?? ''}` : '—', ltr: true },
          { label: ti('location'), value: lot?.locationLabel ?? ti('noBin') },
          { label: tp('supplier'), value: job.supplier?.name ?? '—' },
        ]}
        primary={
          lot ? (
            <Button leadingIcon={<FileText className="h-4 w-4" />} onClick={() => openPdf({ path: `/api/v1/inventory/lots/${lot.id}/qr-label`, documentName: code, filename: `${code}.pdf` })}>
              {ti('printLabel')}
            </Button>
          ) : undefined
        }
        actions={
          <Link href={`/admin/purchasing/fabric/${job.id}`} className="maher-press inline-flex h-10 items-center rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] px-4 text-[14px] font-medium text-[var(--maher-text-primary)] hover:border-[var(--maher-border-strong)]">
            {tp('fabricOpenJob')}
          </Link>
        }
      >
        {expected ? <Meter value={Math.min(arrived, expected)} max={expected} tone={arrived >= expected ? 'success' : 'info'} label={tf('inHolding')} valueLabel={`${arrived} / ${expected} ${job.unit ?? ''}`} /> : null}
      </DetailHero>

      <InventoryScanBar />

      <div className="grid gap-5 xl:grid-cols-12">
        <Board tone="neutral" className="xl:col-span-5">
          <Board.Header title={ti('fabricBundle')} />
          <Board.Body className="flex flex-col items-center gap-3">
            <QrDisplay value={code} size={200} label={ti('scanCode')} />
            {lotStatus ? (
              <Stamp tone={fabricTone(lot?.status)} size="sm">
                {lotStatus}
              </Stamp>
            ) : null}
          </Board.Body>
        </Board>
        <Board tone="neutral" className="xl:col-span-7">
          <Board.Header title={tp('fabricLots')} meta={<span className="tabular-nums">{job.lots?.length ?? 0}</span>} />
          <Board.Body padding="none">
            <Ledger>
              {(job.lots ?? []).map((l) => (
                <LedgerRow key={l.id} label={<Ltr>{l.qrCode ?? l.id.slice(0, 8)}</Ltr>} hint={l.locationLabel ?? ti('noBin')} value={<Ltr>{`${l.remainingQty ?? l.quantity} / ${l.quantity} ${job.unit ?? ''}`}</Ltr>} tone={fabricTone(l.status)} stamp />
              ))}
              {readiness?.derivedStatus ? <LedgerRow label={tCommon('status')} value={stateLabel} /> : null}
            </Ledger>
          </Board.Body>
        </Board>
      </div>
      {pdfDialog}
    </div>
  );
}
