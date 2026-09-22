'use client';

import { CUSTOMER_STATUSES, DealerFormFields, dealerCreatePayload, emptyDealerForm, statusTone, useDealerCopy, validateDealerForm, type CustomerRow, type CustomerStatus, type DealerForm } from '@/components/customers/dealers-shared';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import type { Paginated } from '@/lib/paginated';
import { toApiQuery, useListParams } from '@/lib/use-list-params';
import { localizedName } from '@maher/i18n';
import { Alert, Board, Button, DataBoard, ErrorBoard, Figure, ListToolbar, Ltr, Meter, Pagination, Ribbon, Sheet, Stamp, StatusChips, useToast, type DataColumn } from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';

type SortKey = 'newest' | 'overdue' | 'active' | 'name';
const DEFAULTS = { q: '', status: '' as '' | CustomerStatus, sort: 'newest' as SortKey, page: 1, pageSize: 25 };

function DealersPageInner() {
  const copy = useDealerCopy();
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const { params, set, reset, activeCount } = useListParams({ defaults: DEFAULTS });
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DealerForm>(emptyDealerForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);

  const apiQuery = useMemo(() => toApiQuery({ page: params.page, pageSize: params.pageSize, q: params.q.trim(), status: params.status || undefined }), [params]);
  const list = useQuery({ queryKey: ['customers', apiQuery], queryFn: () => apiFetch<Paginated<CustomerRow>>(`/api/v1/customers${apiQuery}`), placeholderData: keepPreviousData });
  // Pulse: status mix + book totals across the first 100 dealers (cheap, cached a minute).
  const pulse = useQuery({
    queryKey: ['customers-pulse'],
    queryFn: async () => {
      const all = await apiFetch<Paginated<CustomerRow>>('/api/v1/customers?pageSize=100');
      const byStatus = new Map<string, number>();
      let outstanding = 0;
      let invoiced = 0;
      let paid = 0;
      let withDebt = 0;
      let activeOrders = 0;
      for (const c of all.data) {
        byStatus.set(c.status ?? 'ACTIVE', (byStatus.get(c.status ?? 'ACTIVE') ?? 0) + 1);
        outstanding += Number(c.outstandingTotal ?? 0);
        invoiced += Number(c.invoicedTotal ?? 0);
        paid += Number(c.paidTotal ?? 0);
        if (Number(c.outstandingTotal ?? 0) > 0) withDebt += 1;
        activeOrders += Number(c.activeOrdersCount ?? 0);
      }
      return { total: all.meta.totalItems, byStatus, outstanding, invoiced, paid, withDebt, activeOrders };
    },
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: async () => {
      validateDealerForm(form, t, 'create');
      return apiFetch<{ id: string; portalCredentials?: { username: string; temporaryPassword: string } }>('/api/v1/customers', { method: 'POST', body: JSON.stringify(dealerCreatePayload(form)) });
    },
    onSuccess: async (created) => {
      setFormOpen(false);
      setFormError(null);
      toast.success(created.portalCredentials ? t('createdWithPortal') : t('created'));
      setCredentials(created.portalCredentials ?? null);
      await Promise.all([qc.invalidateQueries({ queryKey: ['customers'] }), qc.invalidateQueries({ queryKey: ['customers-pulse'] })]);
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const rows = useMemo(() => {
    const data = [...(list.data?.data ?? [])];
    switch (params.sort) {
      case 'overdue':
        return data.sort((a, b) => Number(b.outstandingTotal ?? 0) - Number(a.outstandingTotal ?? 0));
      case 'active':
        return data.sort((a, b) => Number(b.activeOrdersCount ?? 0) - Number(a.activeOrdersCount ?? 0));
      case 'name':
        return data.sort((a, b) => localizedName(copy.locale, a, a.name).localeCompare(localizedName(copy.locale, b, b.name), copy.locale));
      default:
        return data;
    }
  }, [list.data, params.sort, copy.locale]);
  const meta = list.data?.meta;
  const p = pulse.data;
  const maxOutstanding = Math.max(1, ...rows.map((r) => Number(r.outstandingTotal ?? 0)));

  const columns: DataColumn<CustomerRow>[] = [
    {
      key: 'name',
      header: t('name'),
      cell: (c) => (
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--maher-brand-soft)] text-[12px] font-semibold text-[var(--maher-brand)]">{initials(localizedName(copy.locale, c, c.name))}</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{localizedName(copy.locale, c, c.name)}</span>
            <Ltr className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
              {c.code}
              {c.phone ? ` · ${c.phone}` : ''}
            </Ltr>
          </span>
        </span>
      ),
    },
    { key: 'status', header: t('status'), hideBelow: 'md', cell: (c) => <Stamp tone={statusTone(c.status)} size="sm">{copy.statusLabel(c.status ?? 'ACTIVE')}</Stamp> },
    {
      key: 'orders',
      header: t('activeOrders'),
      hideBelow: 'lg',
      cell: (c) => (
        <span className="flex items-center gap-1.5 text-[13px]">
          <span className="font-semibold text-[var(--maher-text-primary)]" dir="ltr">
            {c.activeOrdersCount ?? 0}
          </span>
          <span className="text-[var(--maher-text-tertiary)]" dir="ltr">
            · {c.waitingOrdersCount ?? 0} / {c.inWorkOrdersCount ?? 0} / {c.doneOrdersCount ?? 0}
          </span>
        </span>
      ),
    },
    { key: 'invoiced', header: tSales('desk.invoiced'), numeric: true, hideBelow: 'xl', cell: (c) => copy.money(c.invoicedTotal) },
    { key: 'paid', header: t('amountPaid'), numeric: true, hideBelow: 'xl', cell: (c) => copy.money(c.paidTotal) },
    {
      key: 'due',
      header: t('amountLeft'),
      numeric: true,
      width: '180px',
      cell: (c) => {
        const due = Number(c.outstandingTotal ?? 0);
        return (
          <span className="flex flex-col items-end gap-1">
            <span className={`font-semibold ${due > 0 ? 'text-[var(--maher-error)]' : 'text-[var(--maher-text-primary)]'}`} dir="ltr">
              {copy.money(due)}
            </span>
            {due > 0 ? <Meter value={due} max={maxOutstanding} size="sm" showValue={false} tone="error" className="w-24" /> : null}
          </span>
        );
      },
    },
  ];

  const sortItems: Array<{ id: SortKey; label: string }> = [
    { id: 'newest', label: tSales('desk.sortNewest') },
    { id: 'overdue', label: t('amountLeft') },
    { id: 'active', label: t('activeOrders') },
    { id: 'name', label: t('name') },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('title')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{t('listHint')}</p>
            </div>
            <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => (setForm(emptyDealerForm()), setFormError(null), setFormOpen(true))}>
              {t('add')}
            </Button>
          </div>
          <div className="min-w-0">
            {p ? <Ribbon size="sm" segments={CUSTOMER_STATUSES.map((s) => ({ key: s, label: copy.statusLabel(s), value: p.byStatus.get(s) ?? 0, tone: statusTone(s) }))} /> : null}
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Figure size="sm" value={p?.total ?? 0} label={t('title')} />
              <Figure size="sm" value={p?.activeOrders ?? 0} label={t('activeOrders')} tone="info" />
              <Figure size="sm" value={copy.money(p?.outstanding ?? 0)} label={t('amountLeft')} tone={p && p.outstanding > 0 ? 'error' : 'success'} locale={copy.locale} />
              <Figure size="sm" value={p?.withDebt ?? 0} label={tSales('desk.dealersWithDebt')} tone={p && p.withDebt > 0 ? 'warning' : 'success'} />
            </div>
            {p && p.invoiced > 0 ? <Meter className="mt-3" value={p.paid} max={p.invoiced} size="sm" label={t('amountPaid')} valueLabel={`${Math.round((p.paid / p.invoiced) * 100)}%`} tone="success" /> : null}
          </div>
        </div>
      </Board>

      {credentials ? (
        <Alert variant="info">
          <p className="font-medium">{t('portalCredentials')}</p>
          <p className="mt-1 text-sm" dir="ltr">
            {t('portalUsername')}: {credentials.username}
          </p>
          <p className="text-sm" dir="ltr">
            {t('portalPassword')}: {credentials.temporaryPassword}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="secondary" leadingIcon={<Copy className="h-4 w-4" />} onClick={() => navigator.clipboard?.writeText(`${credentials.username} / ${credentials.temporaryPassword}`).then(() => toast.success(tCommon('copied')))}>
              {tCommon('copy')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCredentials(null)}>
              {tCommon('close')}
            </Button>
          </div>
          <p className="mt-2 text-xs text-[var(--maher-text-secondary)]">{t('portalCredentialsOnce')}</p>
        </Alert>
      ) : null}

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => set({ q, page: 1 }, { replace: true }), placeholder: t('searchPlaceholder') }}
        sort={{ value: params.sort, options: sortItems.map((s) => ({ value: s.id, label: s.label })), onChange: (sort) => set({ sort }, { replace: true }) }}
      >
        <StatusChips aria-label={t('status')} value={params.status || 'all'} onChange={(id) => set({ status: id === 'all' ? '' : (id as CustomerStatus), page: 1 })} items={[{ id: 'all', label: tCommon('all'), count: p?.total ?? null }, ...CUSTOMER_STATUSES.map((s) => ({ id: s, label: copy.statusLabel(s), count: p?.byStatus.get(s) ?? 0, tone: statusTone(s) }))]} />
      </ListToolbar>

      {list.isError && !list.data ? (
        <ErrorBoard title={t('title')} description={mutationErrorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <DataBoard<CustomerRow>
          aria-label={t('title')}
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          rowHref={(c) => `/admin/customers/${c.id}`}
          LinkComponent={Link}
          loading={list.isLoading && !list.data}
          mobileRow={(c) => ({
            title: localizedName(copy.locale, c, c.name),
            meta: `${c.code} · ${copy.statusLabel(c.status ?? 'ACTIVE')}`,
            trailing: (
              <span className={`text-[13px] font-semibold ${Number(c.outstandingTotal ?? 0) > 0 ? 'text-[var(--maher-error)]' : ''}`} dir="ltr">
                {copy.money(c.outstandingTotal)}
              </span>
            ),
          })}
          empty={
            <Board.Empty
              title={params.q || activeCount ? tSales('desk.emptyFilteredTitle') : t('empty')}
              description={params.q || activeCount ? tSales('desk.emptyFilteredBody') : t('listHint')}
              action={
                params.q || activeCount ? (
                  <Button size="sm" variant="secondary" onClick={reset}>
                    {tCommon('clearFilters')}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setFormOpen(true)}>
                    {t('add')}
                  </Button>
                )
              }
            />
          }
          footer={meta && meta.totalPages > 1 ? <Pagination className="w-full" page={params.page} pageSize={params.pageSize} total={meta.totalItems} onPageChange={(page) => set({ page })} copy={kit.pagination} /> : null}
        />
      )}

      <Sheet
        open={formOpen}
        onClose={() => !create.isPending && setFormOpen(false)}
        title={t('add')}
        description={t('listHint')}
        widthClassName="max-w-xl"
        footer={
          <>
            <Button variant="ghost" disabled={create.isPending} onClick={() => setFormOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <DealerFormFields form={form} setForm={setForm} mode="create" error={formError} />
      </Sheet>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '·';
}

export default function DealersPage() {
  return (
    <Suspense fallback={<div className="maher-board h-64 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />}>
      <DealersPageInner />
    </Suspense>
  );
}
