'use client';

import {
  LineItemsEditor,
  emptyLineItem,
  type LineItemDraft,
} from '@/components/admin/line-items-editor';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { REQUEST_STATUSES, statusOptions } from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  MotionSection,
  PageHero,
  Select,
  Skeleton,
  StatusBadge,
  TextArea,
  cn,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

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
  productCount?: number;
  hasCustomLines?: boolean;
  attachmentCount?: number;
  presentationKey?: string;
  informationRequestReason?: string | null;
}

const RFQ_SOURCES = ['PORTAL', 'SALES', 'WHATSAPP', 'EMAIL', 'PDF', 'PHONE'] as const;
const RFQ_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

type StatusGroupFilter = '' | 'waiting_review' | 'needs_information' | 'drafts';

const STATUS_GROUP_FILTERS: Array<{ value: StatusGroupFilter; labelKey: string }> = [
  { value: '', labelKey: 'all' },
  { value: 'waiting_review', labelKey: 'filterWaitingReview' },
  { value: 'needs_information', labelKey: 'filterNeedsInformation' },
  { value: 'drafts', labelKey: 'filterDrafts' },
];

function presentationLabel(
  key: string | undefined,
  status: string,
  tc: ReturnType<typeof useTranslations>,
  tStatus: ReturnType<typeof useTranslations>,
): string {
  switch (key) {
    case 'waitingForReview':
      return tc('waitingForReview');
    case 'needsInformation':
      return tc('needsInformation');
    case 'draft':
      return tStatus('DRAFT');
    default:
      try {
        return tStatus(status as never);
      } catch {
        return status;
      }
  }
}

export default function AdminRfqsPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tq = useTranslations('quotations');
  const tSales = useTranslations('sales');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [statusGroup, setStatusGroup] = useState<StatusGroupFilter>('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [contactName, setContactName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [source, setSource] = useState('PORTAL');
  const [priority, setPriority] = useState('NORMAL');
  const [lines, setLines] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [notes, setNotes] = useState('');

  function sourceLabel(value: string) {
    const map: Record<string, string> = {
      PORTAL: tq('channelPortal'),
      SALES: tc('sourceSales'),
      WHATSAPP: tq('channelWhatsapp'),
      EMAIL: tq('channelEmail'),
      PDF: tq('channelPdf'),
      PHONE: tq('channelPhone'),
    };
    return map[value] ?? value;
  }

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (statusGroup) {
      params.set('statusGroup', statusGroup);
    } else if (status) {
      params.set('status', status);
    }
    if (customerFilter) params.set('customerId', customerFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    return params.toString();
  }, [q, status, statusGroup, customerFilter, sourceFilter, page]);

  const listQuery = useQuery({
    queryKey: ['admin-rfqs', listParams],
    queryFn: () =>
      apiFetch<{ data: RequestRow[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/requests?${listParams}`,
      ),
    placeholderData: keepPreviousData,
  });

  const customersQuery = useQuery({
    queryKey: ['customers-pick-rfq'],
    queryFn: () =>
      apiFetch<{ data: Customer[] }>('/api/v1/customers?pageSize=100').then((r) => r.data),
  });

  const resetForm = () => {
    setCustomerId('');
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
        .map((line) => ({
          productName: line.description.trim(),
          quantity: Number(line.quantity) || 0,
          notes: line.notes?.trim() || undefined,
        }));
      if (!customerId || items.length === 0) {
        throw new ApiClientError(tc('customerProductRequired'), 400);
      }
      if (items.some((item) => !(item.quantity > 0))) {
        throw new ApiClientError(tc('quantityPositive'), 400);
      }
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
      setCreateOpen(false);
      resetForm();
      setBanner(tc('rfqCreated'));
      router.push(`/requests/${created.id}`);
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const statusFilterOptions = statusOptions(tStatus, REQUEST_STATUSES, {
    label: tCommon('all'),
  });

  if (listQuery.isLoading && !listQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (listQuery.isError && !listQuery.data) {
    return (
      <ErrorState
        title={t('rfqRequests')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;
  const customers = customersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero
        title={t('rfqRequests')}
        description={tc('factoryReview')}
        tone="soft"
        actions={
          <Button
            type="button"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            {tc('newRfq')}
          </Button>
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}

      <MotionSection enter="rise" className="space-y-3">
        <div className="maher-stagger flex flex-wrap gap-2" role="tablist" aria-label={tc('factoryReview')}>
          {STATUS_GROUP_FILTERS.map((item) => {
            const selected = statusGroup === item.value;
            const label =
              item.value === '' ? tCommon('all') : tc(item.labelKey as never);
            return (
              <button
                key={item.value || 'all'}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setPage(1);
                  setStatusGroup(item.value);
                  if (item.value) setStatus('');
                }}
                className={cn(
                  'maher-filter-chip maher-press inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium',
                  selected
                    ? 'border-brand bg-[var(--maher-brand-soft)] text-brand'
                    : 'border-border bg-surface text-text-secondary hover:border-brand/30 hover:text-text-primary',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[220px] flex-1">
            <Input
              withSearchIcon
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder={tc('searchCustomersOrRfqs')}
            />
          </label>
          <Select
            value={customerFilter}
            onChange={(e) => {
              setPage(1);
              setCustomerFilter(e.target.value);
              if (!e.target.value) setSourceFilter('');
            }}
            className="min-w-[200px]"
            aria-label={tc('customer')}
          >
            <option value="">{tc('allCustomers')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {localizedName(locale, c)}
              </option>
            ))}
          </Select>
          {customerFilter ? (
            <Select
              value={sourceFilter}
              onChange={(e) => {
                setPage(1);
                setSourceFilter(e.target.value);
              }}
              className="w-48"
              aria-label={tc('source')}
            >
              <option value="">{tc('allSources')}</option>
              {RFQ_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel(s)}
                </option>
              ))}
            </Select>
          ) : null}
          {!statusGroup ? (
            <Select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              options={statusFilterOptions}
              className="w-48"
            />
          ) : null}
        </div>
      </MotionSection>

      {rows.length === 0 ? (
        <EmptyState title={tc('noRfqs')} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => {
              const dealer = row.customer
                ? localizedName(locale, row.customer)
                : (row.contactName ?? '—');
              const submitted =
                (row.submittedAt ?? row.createdAt)?.slice(0, 10) ?? '—';
              return (
                <article
                  key={row.id}
                  className="maher-list-card flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-semibold text-text-primary">{dealer}</p>
                      <p className="text-xs text-text-tertiary" dir="ltr">
                        {row.number}
                        {row.externalOrderNumber?.trim()
                          ? ` · ${row.externalOrderNumber.trim()}`
                          : ''}
                      </p>
                    </div>
                    <StatusBadge
                      status={row.status}
                      label={presentationLabel(row.presentationKey, row.status, tc, tStatus)}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                    <div>
                      <dt className="text-text-tertiary">{tc('submittedDate')}</dt>
                      <dd className="font-medium text-text-primary" dir="ltr">
                        {submitted}
                      </dd>
                    </div>
                    {row.productCount != null ? (
                      <div>
                        <dt className="text-text-tertiary">{tc('productCount')}</dt>
                        <dd className="font-medium text-text-primary" dir="ltr">
                          {row.productCount}
                        </dd>
                      </div>
                    ) : null}
                    {row.attachmentCount != null ? (
                      <div>
                        <dt className="text-text-tertiary">{tc('attachmentCount')}</dt>
                        <dd className="font-medium text-text-primary" dir="ltr">
                          {row.attachmentCount}
                        </dd>
                      </div>
                    ) : null}
                    {row.hasCustomLines ? (
                      <div>
                        <dt className="text-text-tertiary">{tc('customLines')}</dt>
                        <dd>
                          <Badge variant="warning">{tc('customLines')}</Badge>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {row.informationRequestReason ? (
                    <p className="line-clamp-2 text-xs text-text-secondary">
                      <span className="font-medium text-text-primary">
                        {tc('informationRequestReason')}:{' '}
                      </span>
                      {row.informationRequestReason}
                    </p>
                  ) : null}
                  <div className="mt-auto flex justify-end pt-1">
                    <Link href={`/requests/${row.id}`}>
                      <Button size="sm" variant="secondary">
                        {tc('viewDetails')}
                      </Button>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {tCommon('previous')}
              </Button>
              <span className="text-sm text-text-secondary" dir="ltr">
                {page} / {meta.totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {tCommon('next')}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tc('newRfq')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section space-y-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Select
            label={tc('customer')}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">{tc('select')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {localizedName(locale, c)}
              </option>
            ))}
          </Select>
          <Input
            label={tc('contactName')}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <Input
            label={tc('project')}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <Input
            label={tSales('dealerOrderNumber')}
            value={externalOrderNumber}
            onChange={(e) => setExternalOrderNumber(e.target.value)}
            dir="ltr"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select label={tc('source')} value={source} onChange={(e) => setSource(e.target.value)}>
              {RFQ_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel(s)}
                </option>
              ))}
            </Select>
            <Select
              label={tc('priority')}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={RFQ_PRIORITIES.map((p) => ({ value: p, label: tStatus(p) }))}
            />
          </div>
          <LineItemsEditor
            lines={lines}
            onChange={setLines}
            showUnitPrice={false}
            showNotes
          />
          <div className="space-y-1">
            <TextArea
              label={tc('notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={tc('rfqNotesHint')}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
