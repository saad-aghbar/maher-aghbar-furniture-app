'use client';

import { LineItemsEditor, emptyLineItem, serializeLineItems, type LineItemDraft } from '@/components/admin/line-items-editor';
import { DealerCombobox } from '@/components/orders/dealer-combobox';
import { OrdersListHero } from '@/components/orders/orders-list-hero';
import { daysUntil, quotationTone, useOrdersCopy } from '@/components/orders/orders-shared';
import { Link, useRouter } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import type { Paginated } from '@/lib/paginated';
import { toApiQuery, useListParams } from '@/lib/use-list-params';
import { localizedName, presentQuotationStatus } from '@maher/i18n';
import {
  Alert,
  Board,
  Button,
  DataBoard,
  type DataColumn,
  DateField,
  ErrorBoard,
  FilterDrawer,
  FilterGroup,
  Input,
  ListToolbar,
  Ltr,
  NumberField,
  Pagination,
  Sheet,
  Stamp,
  StatusChips,
  TextArea,
  useToast,
} from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';

interface QuotationRow {
  id: string;
  number: string;
  version?: number;
  total?: string | number;
  currency?: string | null;
  status: string;
  createdAt?: string;
  expirationDate?: string | null;
  commerciallyExpired?: boolean;
  customer?: { id: string; name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null };
  request?: { id: string; number: string; externalOrderNumber?: string | null } | null;
}

/** Chips mirror the quotation lifecycle the factory acts on. */
const CHIPS = [
  { id: '', tone: 'brand' as const },
  { id: 'INTERNAL_REVIEW', tone: 'warning' as const },
  { id: 'APPROVED', tone: 'success' as const },
  { id: 'SENT', tone: 'info' as const },
  { id: 'REVISION_REQUESTED', tone: 'warning' as const },
  { id: 'ACCEPTED', tone: 'success' as const },
  { id: 'REJECTED', tone: 'error' as const },
  { id: 'EXPIRED', tone: 'neutral' as const },
];

const DEFAULTS = { q: '', status: '', customerId: '', page: 1, pageSize: 20 };

function QuotationsPageInner() {
  const copy = useOrdersCopy();
  const kit = useKitCopy();
  const t = useTranslations('quotations');
  const tc = useTranslations('catalog');
  const tNav = useTranslations('navigation');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { params, set, reset, activeCount } = useListParams({ defaults: DEFAULTS });

  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [lines, setLines] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [offeredDeliveryDate, setOfferedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState<number | null>(0.16);

  const apiQuery = useMemo(
    () => toApiQuery({ page: params.page, pageSize: params.pageSize, q: params.q.trim(), status: params.status || undefined, customerId: params.customerId || undefined }),
    [params],
  );

  const list = useQuery({
    queryKey: ['quotations', apiQuery],
    queryFn: () => apiFetch<Paginated<QuotationRow>>(`/api/v1/quotations${apiQuery}`),
    placeholderData: keepPreviousData,
  });

  // Counts per chip come from one probe per status (the API has no facet meta for quotations yet).
  const counts = useQuery({
    queryKey: ['quotations-counts'],
    queryFn: async () => {
      const entries = await Promise.all(
        CHIPS.filter((c) => c.id).map(async (c) => {
          try {
            const r = await apiFetch<Paginated<unknown>>(`/api/v1/quotations?pageSize=1&status=${c.id}`);
            return [c.id, r.meta.totalItems] as const;
          } catch {
            return [c.id, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, number | null>;
    },
    staleTime: 60_000,
  });

  const resetForm = () => {
    setCustomerId(null);
    setLines([emptyLineItem()]);
    setPaymentTerms('');
    setDeliveryTerms('');
    setOfferedDeliveryDate('');
    setNotes('');
    setTaxRate(0.16);
    setFormError(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payloadLines = serializeLineItems(lines).map((line) => ({ ...line, taxRate: taxRate ?? 0, discountType: 'NONE' as const, discountValue: 0 }));
      if (!customerId || payloadLines.length === 0) throw new ApiClientError(t('validationCustomerLines'), 400);
      if (payloadLines.some((line) => !(line.quantity > 0) || Number(line.unitPrice ?? 0) < 0)) throw new ApiClientError(t('validationLineValues'), 400);
      return apiFetch<{ id: string }>('/api/v1/quotations', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          paymentTerms: paymentTerms.trim() || undefined,
          deliveryTerms: deliveryTerms.trim() || undefined,
          offeredDeliveryDate: offeredDeliveryDate || undefined,
          customerNotes: notes.trim() || undefined,
          lines: payloadLines,
        }),
      });
    },
    onSuccess: async (created) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['quotations'] });
      await queryClient.invalidateQueries({ queryKey: ['section-counts'] });
      setCreateOpen(false);
      resetForm();
      toast.success(t('created'));
      router.push(`/admin/quotations/${created.id}`);
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const c = counts.data ?? {};

  const columns: DataColumn<QuotationRow>[] = [
    {
      key: 'number',
      header: t('number'),
      cell: (row) => (
        <span className="flex items-center gap-3">
          <Stamp tone={quotationTone(row.status)} />
          <span className="min-w-0">
            <Ltr block className="font-semibold text-[var(--maher-text-primary)]">
              {row.number}
              {row.version && row.version > 1 ? <span className="ms-1 text-[11px] font-medium text-[var(--maher-text-tertiary)]">v{row.version}</span> : null}
            </Ltr>
            {row.request ? (
              <Ltr block className="text-[12px] text-[var(--maher-text-secondary)]">
                {row.request.number}
                {row.request.externalOrderNumber?.trim() ? ` · ${row.request.externalOrderNumber.trim()}` : ''}
              </Ltr>
            ) : null}
          </span>
        </span>
      ),
    },
    { key: 'customer', header: t('customer'), hideBelow: 'md', cell: (row) => (row.customer ? localizedName(copy.locale, row.customer, row.customer.name) : '—') },
    {
      key: 'status',
      header: tCommon('status'),
      cell: (row) => (
        <Stamp tone={row.commerciallyExpired ? 'neutral' : quotationTone(row.status)} size="sm">
          {presentQuotationStatus(copy.locale, row.status, row.commerciallyExpired)}
        </Stamp>
      ),
    },
    {
      key: 'valid',
      header: t('validUntil'),
      numeric: true,
      hideBelow: 'lg',
      cell: (row) => {
        const days = daysUntil(row.expirationDate);
        const open = row.status === 'SENT' || row.status === 'VIEWED' || row.status === 'APPROVED';
        return (
          <span className="flex flex-col items-end">
            <span>{copy.date(row.expirationDate)}</span>
            {open && days != null ? (
              <span className="text-[11px]" style={{ color: days < 0 ? 'var(--maher-error)' : days <= 3 ? 'var(--maher-warning)' : 'var(--maher-text-tertiary)' }}>
                {days < 0 ? tSales('desk.expiredDays', { count: Math.abs(days) }) : tSales('desk.expiresIn', { count: days })}
              </span>
            ) : null}
          </span>
        );
      },
    },
    { key: 'total', header: t('total'), numeric: true, cell: (row) => copy.money(row.total, row.currency ?? 'ILS') },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <OrdersListHero
        title={t('title')}
        description={tSales('desk.quotationsHint')}
        counts={[
          { key: 'INTERNAL_REVIEW', label: copy.status('INTERNAL_REVIEW'), count: c.INTERNAL_REVIEW ?? 0, tone: 'warning' },
          { key: 'SENT', label: copy.status('SENT'), count: c.SENT ?? 0, tone: 'info' },
          { key: 'REVISION_REQUESTED', label: copy.status('REVISION_REQUESTED'), count: c.REVISION_REQUESTED ?? 0, tone: 'warning' },
          { key: 'ACCEPTED', label: copy.status('ACCEPTED'), count: c.ACCEPTED ?? 0, tone: 'success' },
        ]}
        actions={
          <Button
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            {t('create')}
          </Button>
        }
      />

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => set({ q }, { replace: true }), placeholder: t('searchPlaceholder') }}
        filterCount={params.customerId ? 1 : 0}
        onOpenFilters={() => {
          setDraft(params);
          setFilterOpen(true);
        }}
      >
        <StatusChips
          aria-label={tCommon('status')}
          value={params.status}
          onChange={(status) => set({ status })}
          items={CHIPS.map((chip) => ({ id: chip.id, label: chip.id ? copy.status(chip.id) : tCommon('all'), tone: chip.tone, count: chip.id ? c[chip.id] ?? null : meta?.totalItems ?? null }))}
        />
      </ListToolbar>

      {list.isError && !list.data ? (
        <ErrorBoard title={tCommon('loadFailed')} onRetry={() => list.refetch()} />
      ) : (
        <DataBoard<QuotationRow>
          aria-label={tNav('quotations')}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/quotations/${r.id}`}
          LinkComponent={Link}
          loading={list.isLoading && !list.data}
          mobileRow={(row) => ({
            tone: quotationTone(row.status),
            title: <Ltr>{row.number}</Ltr>,
            meta: `${row.customer ? localizedName(copy.locale, row.customer, row.customer.name) : '—'} · ${presentQuotationStatus(copy.locale, row.status, row.commerciallyExpired)}`,
            trailing: <span>{copy.money(row.total, row.currency ?? 'ILS')}</span>,
          })}
          empty={
            <Board.Empty
              title={params.q || activeCount ? tSales('desk.emptyFilteredTitle') : t('empty')}
              description={params.q || activeCount ? tSales('desk.emptyFilteredBody') : tSales('desk.quotationsEmptyBody')}
              action={
                params.q || activeCount ? (
                  <Button size="sm" variant="secondary" onClick={reset}>
                    {tCommon('clearFilters')}
                  </Button>
                ) : null
              }
            />
          }
          footer={meta && meta.totalPages > 1 ? <Pagination className="w-full" page={params.page} pageSize={params.pageSize} total={meta.totalItems} onPageChange={(page) => set({ page })} copy={kit.pagination} /> : null}
        />
      )}

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={kit.filters.title}
        applyLabel={kit.filters.apply}
        clearLabel={kit.filters.clear}
        closeLabel={kit.filters.close}
        onApply={() => set({ ...draft, page: 1 })}
        onClear={() => {
          setDraft(DEFAULTS);
          reset();
          setFilterOpen(false);
        }}
        count={draft.customerId ? 1 : 0}
      >
        <FilterGroup title={copy.tm('filterDealerTitle')} layout="stack">
          <DealerCombobox value={draft.customerId || null} onChange={(id) => setDraft((d) => ({ ...d, customerId: id ?? '' }))} />
        </FilterGroup>
      </FilterDrawer>

      <Sheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('create')}
        widthClassName="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <DealerCombobox label={t('customer')} value={customerId} onChange={setCustomerId} />
          <LineItemsEditor lines={lines} onChange={setLines} showUnitPrice />
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField label={tc('taxRate')} value={taxRate} onChange={setTaxRate} decimals={2} min={0} max={1} step={0.01} />
            <Input label={tc('paymentTerms')} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            <Input label={tc('deliveryTerms')} value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} />
            <DateField label={t('factoryDelivery')} value={offeredDeliveryDate} onChange={setOfferedDeliveryDate} locale={copy.locale} copy={kit.date} />
            <div className="md:col-span-2"><TextArea autoGrow rows={2} label={tc('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<div className="maher-board h-64 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />}>
      <QuotationsPageInner />
    </Suspense>
  );
}
