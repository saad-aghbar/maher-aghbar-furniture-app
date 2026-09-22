'use client';

import { DealerCombobox } from '@/components/orders/dealer-combobox';
import { approvalTone, attentionKey, chargeTone, lifecycleTone, mediaSrc, useReturnCopy } from '@/components/returns/return-shared';
import type { ReturnRow } from '@/components/returns/return-types';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { useListParams } from '@/lib/use-list-params';
import {
  Board,
  Button,
  DataBoard,
  ErrorBoard,
  Figure,
  FilterDrawer,
  ListToolbar,
  Ltr,
  Meter,
  Ribbon,
  RowThumb,
  Stamp,
  StatusChips,
  type DataColumn,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Armchair } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type Chip = 'attention' | 'all' | 'review' | 'waiting' | 'factory' | 'charges' | 'closed';

const DEFAULTS = { q: '', customerId: '', chip: '' as Chip | '' };

function chipOf(row: ReturnRow): Exclude<Chip, 'all' | 'attention'> {
  const approval = (row.approvalStatus ?? 'PENDING').toUpperCase();
  const lifecycle = (row.lifecycleState ?? '').toUpperCase();
  const physical = (row.physicalStatus ?? 'NONE').toUpperCase();
  const charge = (row.chargeStatus ?? 'NOT_REQUIRED').toUpperCase();
  if (approval === 'PENDING' || approval === 'NEED_INFO') return 'review';
  if (['COMPLETED', 'REJECTED', 'SCRAPPED', 'RETURNED_TO_STOCK'].includes(lifecycle) || approval === 'REJECTED') return 'closed';
  if (charge === 'DRAFT' || charge === 'AWAITING_DEALER' || charge === 'CONFIRMED') return 'charges';
  if (approval === 'APPROVED' && (physical === 'WAITING_RETURN' || lifecycle === 'IN_TRANSIT' || lifecycle === 'APPROVED')) return 'waiting';
  return 'factory';
}

export default function ReturnsPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tLife = useTranslations('lifecycle');
  const tCommon = useTranslations('common');
  const copy = useReturnCopy();
  const kit = useKitCopy();
  const router = useRouter();
  const { params, set, reset } = useListParams({ defaults: DEFAULTS });
  const setParams = (patch: Partial<typeof DEFAULTS>) => set(patch, { replace: true });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCustomer, setDraftCustomer] = useState<string>('');

  const listParams = useMemo(() => {
    const p = new URLSearchParams({ page: '1', pageSize: '100' });
    if (params.q.trim()) p.set('q', params.q.trim());
    if (params.customerId) p.set('customerId', params.customerId);
    return p.toString();
  }, [params.q, params.customerId]);

  const listQuery = useQuery({
    queryKey: ['returns', listParams],
    queryFn: () => apiFetch<{ data: ReturnRow[] }>(`/api/v1/returns?${listParams}`).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const all = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const counts = useMemo(() => {
    const c: Record<Chip, number> = { attention: 0, all: all.length, review: 0, waiting: 0, factory: 0, charges: 0, closed: 0 };
    for (const row of all) {
      c[chipOf(row)] += 1;
      if (attentionKey(row)) c.attention += 1;
    }
    return c;
  }, [all]);
  // Land on the attention lane when something needs a hand; otherwise show everything.
  const chip: Chip = params.chip || (counts.attention ? 'attention' : 'all');
  const rows = useMemo(() => {
    if (chip === 'all') return all;
    if (chip === 'attention') return all.filter((row) => Boolean(attentionKey(row)));
    return all.filter((row) => chipOf(row) === chip);
  }, [all, chip]);
  const openCount = all.length - counts.closed;
  const chargesPending = all.filter((r) => ['DRAFT', 'AWAITING_DEALER'].includes((r.chargeStatus ?? '').toUpperCase())).length;

  const columns: DataColumn<ReturnRow>[] = [
    {
      key: 'product',
      header: t('returns'),
      cell: (row) => (
        <span className="flex items-center gap-3">
          <RowThumb src={mediaSrc(row.productImageUrl)} icon={<Armchair className="h-4 w-4" />} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{row.productDesc}</span>
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--maher-text-tertiary)]">
              <Ltr>{row.number}</Ltr>
              {row.salesOrder?.number ? (
                <>
                  <span>·</span>
                  <Ltr>{row.salesOrder.number}</Ltr>
                </>
              ) : null}
            </span>
          </span>
        </span>
      ),
    },
    { key: 'customer', header: tc('filterDealer'), hideBelow: 'md', cell: (row) => (row.customer ? localizedName(locale, row.customer, row.customer.name) : '—') },
    { key: 'reason', header: tc('reason'), hideBelow: 'lg', cell: (row) => <span className="text-[var(--maher-text-secondary)]">{copy.reason(row.reason)}</span> },
    {
      key: 'state',
      header: tCommon('status'),
      cell: (row) => {
        const attention = copy.attention(row);
        return (
          <span className="flex flex-wrap items-center gap-1">
            <Stamp tone={lifecycleTone(row.lifecycleState) === 'neutral' ? approvalTone(row.approvalStatus) : lifecycleTone(row.lifecycleState)} size="sm">
              {row.lifecycleState ? copy.status(row.lifecycleState) : copy.status(row.approvalStatus ?? 'PENDING')}
            </Stamp>
            {attention ? <Stamp tone="warning" size="sm">{tLife('returnDesk.attentionChip')}</Stamp> : null}
          </span>
        );
      },
    },
    {
      key: 'pieces',
      header: tLife('returnDetail.pieces'),
      hideBelow: 'xl',
      width: '160px',
      cell: (row) =>
        row.pieceSummary?.total ? (
          <Meter value={row.pieceSummary.returned + row.pieceSummary.recovered + row.pieceSummary.readyToReturn} max={row.pieceSummary.total} tone="success" valueLabel={`${row.pieceSummary.returned + row.pieceSummary.recovered}/${row.pieceSummary.total}`} />
        ) : (
          <span className="text-[var(--maher-text-tertiary)]">—</span>
        ),
    },
    {
      key: 'charge',
      header: tLife('returnDetail.chargeStatus'),
      hideBelow: 'lg',
      numeric: true,
      cell: (row) => {
        const status = (row.chargeStatus ?? 'NOT_REQUIRED').toUpperCase();
        if (status === 'NOT_REQUIRED') return <span className="text-[var(--maher-text-tertiary)]">—</span>;
        return (
          <span className="flex flex-col items-end gap-0.5">
            <Ltr className="font-medium">{copy.money(row.chargeAmount)}</Ltr>
            <Stamp tone={chargeTone(status)} size="sm">{copy.chargeStatus(status)}</Stamp>
          </span>
        );
      },
    },
  ];

  const chips: Array<{ id: Chip; label: string; tone?: 'warning' }> = [
    { id: 'attention', label: tLife('returnDesk.attentionChip'), tone: 'warning' },
    { id: 'all', label: tLife('returnDesk.allChip') },
    { id: 'review', label: tLife('returnDesk.reviewChip') },
    { id: 'waiting', label: tLife('returnDesk.waitingChip') },
    { id: 'factory', label: tLife('returnDesk.inFactoryChip') },
    { id: 'charges', label: tLife('returnDesk.chargesChip') },
    { id: 'closed', label: tLife('returnDesk.closedChip') },
  ];

  if (listQuery.isError && !listQuery.data) {
    return <ErrorBoard title={t('returns')} description={tCommon('loadFailed')} onRetry={() => listQuery.refetch()} retryLabel={tCommon('retry')} />;
  }

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={counts.attention ? 'warning' : 'success'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('returns')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tc('returnsDescription')}</p>
          </div>
          <div className="min-w-0">
            <Ribbon
              size="sm"
              segments={[
                { key: 'review', label: tLife('returnDesk.reviewChip'), value: counts.review, tone: 'warning' },
                { key: 'waiting', label: tLife('returnDesk.waitingChip'), value: counts.waiting, tone: 'info' },
                { key: 'factory', label: tLife('returnDesk.inFactoryChip'), value: counts.factory, tone: 'brand' },
                { key: 'charges', label: tLife('returnDesk.chargesChip'), value: counts.charges, tone: 'error' },
                { key: 'closed', label: tLife('returnDesk.closedChip'), value: counts.closed, tone: 'success' },
              ]}
            />
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure size="sm" value={openCount} label={tLife('returnDesk.openCount')} />
              <Figure size="sm" value={counts.attention} label={tLife('returnDesk.attentionChip')} tone={counts.attention ? 'warning' : 'neutral'} />
              <Figure size="sm" value={chargesPending} label={tLife('returnDesk.chargesPending')} tone={chargesPending ? 'error' : 'neutral'} />
            </div>
          </div>
        </div>
      </Board>

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => setParams({ q }), placeholder: tc('returnsSearchPlaceholder') }}
        filterCount={params.customerId ? 1 : 0}
        onOpenFilters={() => {
          setDraftCustomer(params.customerId);
          setFiltersOpen(true);
        }}
      />

      <StatusChips aria-label={tCommon('status')} value={chip} onChange={(id) => setParams({ chip: id as Chip })} items={chips.map((c) => ({ id: c.id, label: c.label, count: counts[c.id], tone: c.tone }))} />

      <DataBoard<ReturnRow>
        aria-label={t('returns')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/admin/returns/${r.id}`)}
        loading={listQuery.isLoading && !listQuery.data}
        mobileRow={(row) => ({
          title: row.productDesc,
          meta: `${row.number} · ${row.customer ? localizedName(locale, row.customer, row.customer.name) : ''}`,
          trailing: <Stamp tone={lifecycleTone(row.lifecycleState)} size="sm">{copy.status(row.lifecycleState ?? row.approvalStatus ?? 'PENDING')}</Stamp>,
        })}
        empty={
          <Board.Empty
            title={params.customerId ? tc('emptyReturnsForDealer') : tc('noReturns')}
            description={tc('returnsEmptyHint')}
            action={chip !== 'all' ? <Button size="sm" variant="secondary" onClick={() => setParams({ chip: 'all' })}>{tLife('returnDesk.allChip')}</Button> : undefined}
          />
        }
      />

      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={kit.filters.title}
        applyLabel={kit.filters.apply}
        clearLabel={kit.filters.clear}
        closeLabel={kit.filters.close}
        count={params.customerId ? 1 : 0}
        onApply={() => {
          setParams({ customerId: draftCustomer });
          setFiltersOpen(false);
        }}
        onClear={() => {
          setDraftCustomer('');
          reset();
          setFiltersOpen(false);
        }}
      >
        <DealerCombobox label={tc('filterDealer')} value={draftCustomer || null} onChange={(id) => setDraftCustomer(id ?? '')} />
      </FilterDrawer>
    </div>
  );
}
