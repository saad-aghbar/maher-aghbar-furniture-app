'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { fabricTone, type FabricJob } from '@/components/purchasing/fabric-shared';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { useListParams } from '@/lib/use-list-params';
import { Board, BoardSkeleton, Button, DataBoard, ErrorBoard, Figure, ListToolbar, Ltr, Meter, Ribbon, Stamp, StatusChips, type DataColumn } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense } from 'react';

type Bucket = '' | 'needsOrdering' | 'waitingSupplier' | 'readyForPickup' | 'inHolding' | 'attention';

const bucketOf = (job: FabricJob): Exclude<Bucket, ''> => {
  const s = (job.state ?? '').toUpperCase();
  if (/RECEIVED|IN_HOLDING|ALLOCATED|READY$/.test(s)) return 'inHolding';
  if (/READY_FOR_PICKUP/.test(s)) return 'readyForPickup';
  if (/UNAVAILABLE|OVERRIDE|ATTENTION/.test(s)) return 'attention';
  if (/SENT|CONFIRMED|WAIT|DELAYED|PARTIAL/.test(s) || job.whatsappSentAt) return 'waitingSupplier';
  return 'needsOrdering';
};

function FabricJobsInner() {
  const t = useTranslations('navigation');
  const tf = useTranslations('mobile.fabricStatus');
  const tCommon = useTranslations('common');
  const tp = useTranslations('purchasing');
  const locale = useLocale();
  const kit = useKitCopy();
  const { params, set, reset, activeCount } = useListParams({ defaults: { q: '', bucket: '' as Bucket } });
  const query = useQuery({ queryKey: ['fabric-procurements'], queryFn: () => apiFetch<FabricJob[] | { data: FabricJob[] }>('/api/v1/fabric-procurements').then((json) => (Array.isArray(json) ? json : (json.data ?? []))), refetchInterval: 60_000 });

  if (query.isLoading) return <BoardSkeleton rows={6} />;
  if (query.isError) return <ErrorBoard title={t('fabricJobs')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  const rows = query.data ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, r) => ((acc[bucketOf(r)] = (acc[bucketOf(r)] ?? 0) + 1), acc), {});
  const visible = rows.filter((r) => {
    if (params.bucket && bucketOf(r) !== params.bucket) return false;
    if (params.q.trim()) {
      const q = params.q.trim().toLowerCase();
      return [r.requestedLabel, r.qrCode, r.sku, r.salesOrderNumber, r.dealerName, r.productName, r.supplier?.name].some((v) => v?.toLowerCase().includes(q));
    }
    return true;
  });
  const label = (job: FabricJob) => job.requestedLabel ?? job.productName ?? job.sku ?? job.qrCode ?? job.id.slice(0, 8);
  const date = (v?: string | null) => (v ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(v)) : '—');
  const BUCKETS: Array<{ id: Exclude<Bucket, ''>; tone: 'info' | 'warning' | 'success' | 'error' | 'neutral' }> = [
    { id: 'needsOrdering', tone: 'info' },
    { id: 'waitingSupplier', tone: 'warning' },
    { id: 'readyForPickup', tone: 'warning' },
    { id: 'inHolding', tone: 'success' },
    { id: 'attention', tone: 'error' },
  ];

  const columns: DataColumn<FabricJob>[] = [
    {
      key: 'job',
      header: t('fabricJobs'),
      cell: (job) => (
        <span className="flex items-center gap-3">
          <InventoryItemThumb src={job.imageUrl ?? job.productImageUrl} alt="" size={36} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{label(job)}</span>
            <Ltr className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
              {job.sku ?? job.qrCode ?? ''}
              {job.itemLetter ? ` · ${job.itemLetter}` : ''}
            </Ltr>
          </span>
        </span>
      ),
    },
    { key: 'order', header: t('salesOrders'), hideBelow: 'md', cell: (job) => (job.salesOrderId ? <Link href={`/admin/sales-orders/${job.salesOrderId}`} className="hover:text-[var(--maher-brand)]"><Ltr>{job.salesOrderNumber}</Ltr></Link> : '—') },
    { key: 'dealer', header: tp('dealer'), hideBelow: 'lg', cell: (job) => job.dealerName ?? '—' },
    { key: 'supplier', header: tp('supplier'), hideBelow: 'lg', cell: (job) => job.supplier?.name ?? '—' },
    { key: 'expected', header: tp('expectedDate'), hideBelow: 'xl', cell: (job) => date(job.expectedAvailableAt) },
    {
      key: 'progress',
      header: tf('inHolding'),
      width: '160px',
      hideBelow: 'md',
      cell: (job) => {
        const arrived = job.arrivedQty ?? (job.lots ?? []).reduce((s, l) => s + Number(l.quantity ?? 0), 0);
        const required = job.requiredQty ?? null;
        return required ? <Meter value={Math.min(arrived, required)} max={required} size="sm" valueLabel={`${arrived}/${required}`} tone={arrived >= required ? 'success' : 'brand'} /> : <span className="text-[12px] text-[var(--maher-text-tertiary)]" dir="ltr">{arrived || '—'}</span>;
      },
    },
    { key: 'state', header: tCommon('status'), cell: (job) => <Stamp tone={fabricTone(job.state)} size="sm">{tf(bucketOf(job))}</Stamp> },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={(counts.attention ?? 0) > 0 ? 'error' : 'brand'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('fabricJobs')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tp('fabricJobsHint')}</p>
          </div>
          <div className="min-w-0">
            <Ribbon size="sm" segments={BUCKETS.map((b) => ({ key: b.id, label: tf(b.id), value: counts[b.id] ?? 0, tone: b.tone }))} />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Figure size="sm" value={rows.length} label={t('fabricJobs')} />
              <Figure size="sm" value={counts.waitingSupplier ?? 0} label={tf('waitingSupplier')} tone="warning" />
              <Figure size="sm" value={counts.readyForPickup ?? 0} label={tf('readyForPickup')} tone={(counts.readyForPickup ?? 0) ? 'warning' : 'neutral'} />
              <Figure size="sm" value={counts.attention ?? 0} label={tf('attention')} tone={(counts.attention ?? 0) ? 'error' : 'success'} />
            </div>
          </div>
        </div>
      </Board>
      <ListToolbar copy={kit.toolbar} search={{ value: params.q, onChange: (q) => set({ q }, { replace: true }), placeholder: tCommon('search') }}>
        <StatusChips aria-label={tCommon('status')} value={params.bucket || 'all'} onChange={(id) => set({ bucket: id === 'all' ? '' : (id as Bucket) })} items={[{ id: 'all', label: tCommon('all'), count: rows.length }, ...BUCKETS.map((b) => ({ id: b.id, label: tf(b.id), count: counts[b.id] ?? 0, tone: b.tone }))]} />
      </ListToolbar>
      <DataBoard<FabricJob>
        aria-label={t('fabricJobs')}
        columns={columns}
        rows={visible}
        rowKey={(r) => r.id}
        rowHref={(r) => `/admin/purchasing/fabric/${r.id}`}
        LinkComponent={Link}
        rowClassName={(r) => (bucketOf(r) === 'attention' ? 'bg-[var(--maher-error-soft)]/30' : undefined)}
        mobileRow={(job) => ({ leading: <InventoryItemThumb src={job.imageUrl ?? job.productImageUrl} alt="" size={36} />, title: label(job), meta: `${job.salesOrderNumber}${job.supplier ? ` · ${job.supplier.name}` : ''}`, trailing: <Stamp tone={fabricTone(job.state)} size="sm">{tf(bucketOf(job))}</Stamp> })}
        empty={<Board.Empty title={t('fabricJobs')} description={tp('fabricJobsEmpty')} action={params.q || activeCount ? <Button size="sm" variant="secondary" onClick={reset}>{tCommon('clearFilters')}</Button> : undefined} />}
      />
    </div>
  );
}

export default function FabricJobsPage() {
  return (
    <Suspense fallback={<BoardSkeleton rows={6} />}>
      <FabricJobsInner />
    </Suspense>
  );
}
