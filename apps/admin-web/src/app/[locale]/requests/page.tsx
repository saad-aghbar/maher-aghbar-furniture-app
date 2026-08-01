'use client';

import {
  LineItemsEditor,
  emptyLineItem,
  type LineItemDraft,
} from '@/components/admin/line-items-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { REQUEST_STATUSES, statusOptions } from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextArea,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
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
  priority?: string;
  customer?: Customer | null;
  contactName?: string | null;
  createdAt: string;
}

const RFQ_SOURCES = ['PORTAL', 'SALES', 'WHATSAPP', 'EMAIL', 'PDF', 'PHONE'] as const;
const RFQ_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export default function AdminRfqsPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tq = useTranslations('quotations');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [contactName, setContactName] = useState('');
  const [projectName, setProjectName] = useState('');
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
    if (status) params.set('status', status);
    if (customerFilter) params.set('customerId', customerFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    return params.toString();
  }, [q, status, customerFilter, sourceFilter, page]);

  const listQuery = useQuery({
    queryKey: ['admin-rfqs', listParams],
    queryFn: () =>
      apiFetch<{ data: RequestRow[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/requests?${listParams}`,
      ),
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

  if (listQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (listQuery.isError) {
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
      <PageHeader
        title={t('rfqRequests')}
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            className="ps-9"
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
        <Select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          options={statusFilterOptions}
          className="w-48"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title={tc('noRfqs')} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                <TableHeaderCell>{tc('customer')}</TableHeaderCell>
                <TableHeaderCell>{tc('project')}</TableHeaderCell>
                <TableHeaderCell>{tc('source')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell dir="ltr">{row.number}</TableCell>
                  <TableCell>
                    {row.customer
                      ? localizedName(locale, row.customer)
                      : (row.contactName ?? '—')}
                  </TableCell>
                  <TableCell>{row.projectName ?? '—'}</TableCell>
                  <TableCell>{row.source ? sourceLabel(row.source) : '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/requests/${row.id}`}>
                      <Button size="sm" variant="secondary">
                        {tc('viewDetails')}
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        <div className="space-y-3">
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
