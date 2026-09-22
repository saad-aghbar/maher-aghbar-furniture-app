'use client';

import { LineItemsEditor, emptyLineItem, type LineItemDraft } from '@/components/admin/line-items-editor';
import { DealerCombobox } from '@/components/orders/dealer-combobox';
import { OrdersListHero } from '@/components/orders/orders-list-hero';
import { daysUntil, requestTone, useOrdersCopy } from '@/components/orders/orders-shared';
import { Link, useRouter } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import type { Paginated } from '@/lib/paginated';
import { toApiQuery, useListParams } from '@/lib/use-list-params';
import { localizedName } from '@maher/i18n';
import {
  Alert,
  Board,
  Button,
  DataBoard,
  ErrorBoard,
  FilterChip,
  FilterDrawer,
  FilterGroup,
  Input,
  ListToolbar,
  Ltr,
  Pagination,
  Select,
  Sheet,
  Stamp,
  StatusChips,
  TextArea,
  useToast,
  type DataColumn,
} from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';

interface Customer {
  id: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  code: string;
}

interface RequestRow {
  id: string;
  number: string;
  status: string;
  source?: string;
  projectName?: string | null;
  externalOrderNumber?: string | null;
  priority?: string;
  customer?: Customer | null;
  contactName?: string | null;
  createdAt: string;
  submittedAt?: string | null;
  requiredDeliveryDate?: string | null;
  productCount?: number;
  hasCustomLines?: boolean;
  attachmentCount?: number;
  presentationKey?: string;
  informationRequestReason?: string | null;
  requestType?: string | null;
}

type InboxChip = 'open_inbox' | 'waiting_review' | 'needs_information' | 'quoted' | 'drafts' | 'closed';
const INBOX: InboxChip[] = ['open_inbox', 'waiting_review', 'needs_information', 'quoted', 'drafts', 'closed'];
const COUNT_KEY: Record<InboxChip, 'all' | 'waiting' | 'needs_info' | 'quoted' | 'drafts' | null> = {
  open_inbox: 'all',
  waiting_review: 'waiting',
  needs_information: 'needs_info',
  quoted: 'quoted',
  drafts: 'drafts',
  closed: null,
};
const RFQ_SOURCES = ['PORTAL', 'SALES', 'WHATSAPP', 'EMAIL', 'PDF', 'PHONE'] as const;
const RFQ_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

const DEFAULTS = {
  q: '',
  group: 'open_inbox' as InboxChip,
  customerId: '',
  source: '',
  requestType: '',
  page: 1,
  pageSize: 20,
};

type ListMeta = Paginated<RequestRow>['meta'] & {
  inboxCounts?: { all: number; waiting: number; needs_info: number; quoted: number; drafts: number };
  typeCounts?: Record<string, number>;
};

function RequestsPageInner() {
  const copy = useOrdersCopy();
  const kit = useKitCopy();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tStatus = useTranslations('statuses');
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
  const [contactName, setContactName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [source, setSource] = useState('PORTAL');
  const [priority, setPriority] = useState('NORMAL');
  const [lines, setLines] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [notes, setNotes] = useState('');

  const sourceLabel = (value: string) => copy.source(value);

  const apiQuery = useMemo(
    () =>
      toApiQuery({
        page: params.page,
        pageSize: params.pageSize,
        q: params.q.trim(),
        statusGroup: params.group,
        customerId: params.customerId || undefined,
        source: params.source || undefined,
        requestType: params.requestType || undefined,
      }),
    [params],
  );

  const list = useQuery({
    queryKey: ['admin-rfqs', apiQuery],
    queryFn: () => apiFetch<{ data: RequestRow[]; meta: ListMeta }>(`/api/v1/requests${apiQuery}`),
    placeholderData: keepPreviousData,
  });

  const resetForm = () => {
    setCustomerId(null);
    setContactName('');
    setProjectName('');
    setExternalOrderNumber('');
    setSource('PORTAL');
    setPriority('NORMAL');
    setLines([emptyLineItem()]);
    setNotes('');
    setFormError(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const items = lines
        .filter((line) => line.description.trim())
        .map((line) => ({ productName: line.description.trim(), quantity: Number(line.quantity) || 0, notes: line.notes?.trim() || undefined }));
      if (!customerId || items.length === 0) throw new ApiClientError(tc('customerProductRequired'), 400);
      if (items.some((item) => !(item.quantity > 0))) throw new ApiClientError(tc('quantityPositive'), 400);
      return apiFetch<{ id: string }>('/api/v1/requests', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          contactName: contactName.trim() || undefined,
          projectName: projectName.trim() || undefined,
          externalOrderNumber: externalOrderNumber.trim() || undefined,
          source,
          priority,
          notes: notes.trim() || undefined,
          items,
        }),
      });
    },
    onSuccess: async (created) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-rfqs'] });
      await queryClient.invalidateQueries({ queryKey: ['section-counts'] });
      setCreateOpen(false);
      resetForm();
      toast.success(tc('rfqCreated'));
      router.push(`/admin/requests/${created.id}`);
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const counts = meta?.inboxCounts;

  const presentation = (row: RequestRow) => {
    switch (row.presentationKey) {
      case 'waitingForReview':
        return tc('waitingForReview');
      case 'needsInformation':
        return tc('needsInformation');
      case 'draft':
        return tStatus('DRAFT');
      default:
        return copy.status(row.status);
    }
  };

  const waitingDays = (row: RequestRow) => {
    const since = row.submittedAt ?? row.createdAt;
    const d = daysUntil(since);
    return d == null ? null : Math.abs(d);
  };

  const columns: DataColumn<RequestRow>[] = [
    {
      key: 'dealer',
      header: tc('customer'),
      cell: (row) => (
        <span className="flex items-center gap-3">
          <Stamp tone={requestTone(row.status)} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{row.customer ? localizedName(copy.locale, row.customer) : row.contactName ?? '—'}</span>
            <Ltr block className="text-[12px] text-[var(--maher-text-secondary)]">
              {row.number}
              {row.externalOrderNumber?.trim() ? ` · ${row.externalOrderNumber.trim()}` : ''}
            </Ltr>
          </span>
        </span>
      ),
    },
    {
      key: 'project',
      header: tc('project'),
      hideBelow: 'lg',
      cell: (row) => (
        <span className="block">
          <span className="block truncate">{row.projectName || '—'}</span>
          {row.informationRequestReason ? <span className="block truncate text-[12px] text-[var(--maher-warning)]">{row.informationRequestReason}</span> : null}
        </span>
      ),
    },
    {
      key: 'status',
      header: tCommon('status'),
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Stamp tone={requestTone(row.status)} size="sm">
            {presentation(row)}
          </Stamp>
          {row.hasCustomLines ? (
            <Stamp tone="warning" size="sm">
              {tc('customLines')}
            </Stamp>
          ) : null}
        </span>
      ),
    },
    {
      key: 'items',
      header: tc('productCount'),
      numeric: true,
      hideBelow: 'md',
      cell: (row) => (
        <span className="flex flex-col items-end">
          <span>{row.productCount ?? '—'}</span>
          {row.attachmentCount ? <span className="text-[11px] text-[var(--maher-text-tertiary)]">{tSales('desk.attachmentCount', { count: row.attachmentCount })}</span> : null}
        </span>
      ),
    },
    {
      key: 'source',
      header: tc('source'),
      hideBelow: 'xl',
      cell: (row) => (row.source ? sourceLabel(row.source) : '—'),
    },
    {
      key: 'submitted',
      header: tc('submittedDate'),
      numeric: true,
      cell: (row) => {
        const days = waitingDays(row);
        const waiting = row.status === 'SUBMITTED' || row.status === 'UNDER_REVIEW';
        return (
          <span className="flex flex-col items-end">
            <span>{copy.date(row.submittedAt ?? row.createdAt)}</span>
            {waiting && days != null && days > 0 ? (
              <span className="text-[11px]" style={{ color: days > 3 ? 'var(--maher-warning)' : 'var(--maher-text-tertiary)' }}>
                {tSales('desk.waitingDays', { count: days })}
              </span>
            ) : null}
          </span>
        );
      },
    },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <OrdersListHero
        title={t('rfqRequests')}
        description={tc('factoryReview')}
        counts={
          counts
            ? [
                { key: 'waiting', label: copy.tm('rfqInbox.waiting'), count: counts.waiting, tone: 'info' },
                { key: 'needs_info', label: copy.tm('rfqInbox.needs_info'), count: counts.needs_info, tone: 'warning' },
                { key: 'quoted', label: copy.tm('rfqInbox.quoted'), count: counts.quoted, tone: 'success' },
                { key: 'drafts', label: copy.tm('rfqInbox.drafts'), count: counts.drafts, tone: 'neutral' },
              ]
            : undefined
        }
        actions={
          <Button
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            {tc('newRfq')}
          </Button>
        }
      />

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => set({ q }, { replace: true }), placeholder: tc('searchCustomersOrRfqs') }}
        filterCount={[params.customerId, params.source, params.requestType].filter(Boolean).length}
        onOpenFilters={() => {
          setDraft(params);
          setFilterOpen(true);
        }}
      >
        <StatusChips
          aria-label={tCommon('status')}
          value={params.group}
          onChange={(group) => set({ group: group as InboxChip })}
          items={INBOX.map((chip) => ({
            id: chip,
            label: chip === 'closed' ? tStatus('CLOSED') : copy.tm(`rfqInbox.${COUNT_KEY[chip]}` as never),
            count: COUNT_KEY[chip] && counts ? counts[COUNT_KEY[chip]!] : null,
            tone: chip === 'needs_information' ? 'warning' : chip === 'quoted' ? 'success' : chip === 'waiting_review' ? 'info' : 'brand',
          }))}
        />
      </ListToolbar>

      {list.isError && !list.data ? (
        <ErrorBoard title={tCommon('loadFailed')} onRetry={() => list.refetch()} />
      ) : (
        <DataBoard<RequestRow>
          aria-label={t('rfqRequests')}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/requests/${r.id}`}
          LinkComponent={Link}
          loading={list.isLoading && !list.data}
          rowClassName={(r) => (r.status === 'NEEDS_INFORMATION' ? 'bg-[color:color-mix(in_oklab,var(--maher-warning)_6%,transparent)]' : undefined)}
          mobileRow={(row) => ({
            tone: requestTone(row.status),
            title: row.customer ? localizedName(copy.locale, row.customer) : row.contactName ?? row.number,
            meta: `${row.number} · ${presentation(row)}`,
            trailing: <span className="text-[12px] text-[var(--maher-text-secondary)]">{copy.date(row.submittedAt ?? row.createdAt)}</span>,
          })}
          empty={
            <Board.Empty
              title={params.q || activeCount ? tSales('desk.emptyFilteredTitle') : copy.tm('requestsEmptyTitle')}
              description={params.q || activeCount ? tSales('desk.emptyFilteredBody') : copy.tm('requestsEmptyBody')}
              action={
                params.q || activeCount ? (
                  <Button size="sm" variant="secondary" onClick={reset}>
                    {tCommon('clearFilters')}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    {tc('newRfq')}
                  </Button>
                )
              }
            />
          }
          footer={
            meta && meta.totalPages > 1 ? (
              <Pagination className="w-full" page={params.page} pageSize={params.pageSize} total={meta.totalItems} onPageChange={(page) => set({ page })} copy={kit.pagination} />
            ) : null
          }
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
        count={[draft.customerId, draft.source, draft.requestType].filter(Boolean).length}
      >
        <FilterGroup title={copy.tm('filterDealerTitle')} layout="stack">
          <DealerCombobox value={draft.customerId || null} onChange={(id) => setDraft((d) => ({ ...d, customerId: id ?? '' }))} />
        </FilterGroup>
        <FilterGroup title={tc('source')}>
          <FilterChip selected={!draft.source} onClick={() => setDraft((d) => ({ ...d, source: '' }))}>
            {tCommon('all')}
          </FilterChip>
          {RFQ_SOURCES.map((s) => (
            <FilterChip key={s} selected={draft.source === s} onClick={() => setDraft((d) => ({ ...d, source: s }))}>
              {sourceLabel(s)}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup title={tSales('desk.orderType')}>
          {(['', 'STANDARD', 'MODIFIED', 'CUSTOM'] as const).map((type) => (
            <FilterChip
              key={type || 'all'}
              selected={draft.requestType === type}
              onClick={() => setDraft((d) => ({ ...d, requestType: type }))}
              count={type && meta?.typeCounts ? meta.typeCounts[type.toLowerCase()] ?? null : null}
            >
              {type ? tSales(`desk.orderType${type}` as never) : tCommon('all')}
            </FilterChip>
          ))}
        </FilterGroup>
      </FilterDrawer>

      <Sheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tc('newRfq')}
        description={tc('factoryReview')}
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
          <DealerCombobox label={tc('customer')} value={customerId} onChange={setCustomerId} clearable />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={tc('contactName')} value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input label={tc('project')} value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <Input label={tSales('dealerOrderNumber')} value={externalOrderNumber} onChange={(e) => setExternalOrderNumber(e.target.value)} dir="ltr" />
            <div className="grid grid-cols-2 gap-3">
              <Select label={tc('source')} value={source} onChange={(e) => setSource(e.target.value)}>
                {RFQ_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {sourceLabel(s)}
                  </option>
                ))}
              </Select>
              <Select label={tc('priority')} value={priority} onChange={(e) => setPriority(e.target.value)} options={RFQ_PRIORITIES.map((p) => ({ value: p, label: tStatus(p) }))} />
            </div>
          </div>
          <LineItemsEditor lines={lines} onChange={setLines} showUnitPrice={false} showNotes />
          <TextArea autoGrow label={tc('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={tc('rfqNotesHint')} />
        </div>
      </Sheet>
    </div>
  );
}

export default function AdminRfqsPage() {
  return (
    <Suspense fallback={<div className="maher-board h-64 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />}>
      <RequestsPageInner />
    </Suspense>
  );
}
