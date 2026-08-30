'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHero,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableNumericCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

interface SalesOrder {
  id: string;
  number: string;
  status: string;
  customer?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
}
interface DeliveryRow {
  id: string;
  number: string;
  status: string;
  deliveryAddress: string;
  deliveryDate?: string | null;
  customerConfirmedAt?: string | null;
  actualDeliveredAt?: string | null;
  customer?: {
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
  } | null;
  load?: { total: number; loaded: number; incomplete: boolean } | null;
  attentionReasons?: Array<'OVERDUE_PLANNED' | 'INCOMPLETE_LOAD'>;
}

const STATUS_FLOW = ['PLANNED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

type DeliverySection = 'planned' | 'ready' | 'shipped' | 'delivered' | 'attention';

const DELIVERY_SECTIONS: DeliverySection[] = [
  'planned',
  'ready',
  'shipped',
  'delivered',
  'attention',
];

const SECTION_STATUS: Partial<Record<DeliverySection, string>> = {
  planned: 'PLANNED',
  ready: 'READY',
  shipped: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
};

function parseDeliverySection(value: string | null): DeliverySection {
  if (value && DELIVERY_SECTIONS.includes(value as DeliverySection)) {
    return value as DeliverySection;
  }
  return 'ready';
}

function nextStatus(current: string): string | null {
  // Commercial DELIVERED is dealer confirm-receipt only — staff may only advance to truck departed.
  if (current === 'OUT_FOR_DELIVERY' || current === 'DELIVERED') return null;
  const i = STATUS_FLOW.indexOf(current as (typeof STATUS_FLOW)[number]);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null;
  const next = STATUS_FLOW[i + 1]!;
  if (next === 'DELIVERED') return null;
  return next;
}

function advanceActionLabel(
  next: string,
  tStatus: (key: string) => string,
  tc: (key: string, values?: Record<string, string>) => string,
  tl: (key: string) => string,
): string {
  if (next === 'OUT_FOR_DELIVERY') return tl('markTruckDeparted');
  return tc('advanceTo', { status: tStatus(next) });
}

function sectionEmptyTitle(
  section: DeliverySection,
  tc: (key: string) => string,
  tl: (key: string) => string,
): string {
  switch (section) {
    case 'ready':
      return tl('noReady');
    case 'planned':
      return tc('noDeliveries');
    case 'shipped':
      return tl('noShipped');
    case 'delivered':
      return tl('noDelivered');
    case 'attention':
      return tl('noAttentionDeliveries');
  }
}

function sectionTabLabel(section: DeliverySection, tl: (key: string) => string): string {
  switch (section) {
    case 'ready':
      return tl('adminDeliveryReady');
    case 'planned':
      return tl('adminDeliveryPlanned');
    case 'shipped':
      return tl('adminDeliveryShipped');
    case 'delivered':
      return tl('adminDeliveryDelivered');
    case 'attention':
      return tl('adminDeliveryAttention');
  }
}

function attentionWhy(
  row: DeliveryRow,
  tl: (key: string, values?: Record<string, string | number>) => string,
): string[] {
  const reasons = row.attentionReasons ?? [];
  const lines: string[] = [];
  for (const reason of reasons) {
    if (reason === 'OVERDUE_PLANNED') {
      lines.push(tl('attentionOverduePlanned'));
    } else if (reason === 'INCOMPLETE_LOAD') {
      const total = row.load?.total ?? 0;
      const loaded = row.load?.loaded ?? 0;
      lines.push(tl('attentionIncompleteLoad', { loaded, total }));
    }
  }
  return lines;
}

export default function DeliveriesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <DeliveriesPageInner />
    </Suspense>
  );
}

function DeliveriesPageInner() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const tl = useTranslations('lifecycle');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [banner, setBanner] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [salesOrderId, setSalesOrderId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [driverId, setDriverId] = useState('');
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<DeliverySection>(() =>
    parseDeliverySection(searchParams.get('section')),
  );

  useEffect(() => {
    setSection(parseDeliverySection(searchParams.get('section')));
  }, [searchParams]);

  function selectSection(next: DeliverySection) {
    if (next === section) return;
    setSection(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (section === 'attention') {
      params.set('attention', 'true');
    } else {
      params.set('status', SECTION_STATUS[section]!);
    }
    if (search.trim()) params.set('q', search.trim());
    return params.toString();
  }, [search, section]);

  const listQuery = useQuery({
    queryKey: ['deliveries', listParams],
    queryFn: () =>
      apiFetch<{
        data: DeliveryRow[];
        meta?: { totalItems: number; page: number; pageSize: number };
      }>(`/api/v1/deliveries?${listParams}`),
    placeholderData: keepPreviousData,
  });
  const driversQuery = useQuery({
    queryKey: ['drivers-pick'],
    queryFn: () =>
      apiFetch<{
        data: Array<{
          id: string;
          firstName: string;
          lastName: string;
          roles?: Array<{ role: { code: string } }>;
        }>;
      }>('/api/v1/users?pageSize=100').then((r) =>
        (r.data ?? []).filter((u) =>
          u.roles?.some((role) =>
            ['PRODUCTION_WORKER'].includes(
              role.role.code,
            ),
          ),
        ),
      ),
  });
  const soQuery = useQuery({
    queryKey: ['sales-orders-pick-delivery'],
    queryFn: () =>
      apiFetch<{ data: SalesOrder[] }>(
        '/api/v1/sales-orders?pageSize=100&status=READY_FOR_DELIVERY',
      ).then((r) => r.data),
    enabled: createOpen,
  });

  const rows = listQuery.data?.data ?? [];
  const datasetCount = listQuery.data?.meta?.totalItems ?? rows.length;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!salesOrderId || !deliveryAddress.trim()) {
        throw new ApiClientError(tc('salesOrderAddressRequired'), 400);
      }
      const so = (soQuery.data ?? []).find((s) => s.id === salesOrderId);
      if (!so?.customer?.id) {
        throw new ApiClientError(tc('salesOrderAddressRequired'), 400);
      }
      return apiFetch('/api/v1/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          customerId: so.customer.id,
          salesOrderId,
          deliveryAddress: deliveryAddress.trim(),
          notes: notes.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setCreateOpen(false);
      setBanner(tc('deliveryPlanned'));
      selectSection('planned');
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: (args: { id: string; status: string; driverId?: string }) =>
      apiFetch(`/api/v1/deliveries/${args.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(args),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-finished-lots'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-semi-finished'] });
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['production-order'] });
      setBanner(tc('deliveryStatusUpdated'));
    },
    onError: (err) => setBanner(mutationErrorMessage(err)),
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
    return <ErrorState title={t('deliveries')} onRetry={() => listQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={t('deliveries')}
        tone="soft"
        actions={
          <Button
            type="button"
            onClick={() => {
              setSalesOrderId('');
              setDeliveryAddress('');
              setNotes('');
              setFormError(null);
              setCreateOpen(true);
            }}
          >
            {tc('planDelivery')}
          </Button>
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}

      <div
        role="tablist"
        aria-label={t('deliveries')}
        className="flex flex-wrap gap-2"
      >
        {DELIVERY_SECTIONS.map((key) => {
          const selected = section === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectSection(key)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                selected
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
              }`}
            >
              {sectionTabLabel(key, tl)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tCommon('search')}
          withSearchIcon
          className="max-w-xs"
        />
        <Select
          label={tc('defaultDriver')}
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
        >
          <option value="">{tc('currentUser')}</option>
          {(driversQuery.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.firstName} {d.lastName}
            </option>
          ))}
        </Select>
        <p className="text-sm text-text-tertiary" dir="ltr">
          {tl('adminDeliveryDatasetCount', { count: datasetCount })}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={sectionEmptyTitle(section, tc, tl)} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
              <TableHeaderCell>{tSales('systemOrderNumber')}</TableHeaderCell>
              <TableHeaderCell>{tSales('dealerOrderNumber')}</TableHeaderCell>
              <TableHeaderCell>{tc('customer')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('address')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const next = nextStatus(row.status);
              const why = section === 'attention' ? attentionWhy(row, tl) : [];
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/deliveries/${row.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      <span dir="ltr">{row.number}</span>
                    </Link>
                  </TableCell>
                  <TableNumericCell>{row.salesOrder?.number ?? '—'}</TableNumericCell>
                  <TableNumericCell>
                    {row.salesOrder?.externalOrderNumber?.trim() || '—'}
                  </TableNumericCell>
                  <TableCell>
                    {row.customer
                      ? localizedName(locale, row.customer, row.customer.name)
                      : '—'}
                  </TableCell>
                  <TableCell>{row.deliveryAddress}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <StatusBadge status={row.status} />
                      {row.status === 'OUT_FOR_DELIVERY' ? (
                        <p className="text-xs font-medium text-brand">
                          {tl('awaitingDealerConfirmation')}
                        </p>
                      ) : null}
                      {why.map((line) => (
                        <p key={line} className="text-xs text-amber-800 dark:text-amber-200">
                          {line}
                        </p>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/deliveries/${row.id}`}
                        className="text-sm text-brand hover:underline"
                      >
                        {tCommon('details')}
                      </Link>
                      {next && next !== 'DELIVERED' ? (
                        <Button
                          size="sm"
                          variant="subtle"
                          loading={statusMutation.isPending}
                          onClick={() =>
                            statusMutation.mutate({
                              id: row.id,
                              status: next,
                              driverId:
                                next === 'OUT_FOR_DELIVERY' ? driverId || undefined : undefined,
                            })
                          }
                        >
                          {advanceActionLabel(next, tStatus, tc, tl)}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tc('planDelivery')}
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
            label={tc('salesOrder')}
            value={salesOrderId}
            onChange={(e) => setSalesOrderId(e.target.value)}
          >
            <option value="">{tc('select')}</option>
            {(soQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.number} —{' '}
                {s.customer
                  ? localizedName(locale, s.customer, s.customer.name)
                  : tStatus(s.status as never)}
              </option>
            ))}
          </Select>
          <p className="text-xs text-text-secondary">{tc('readyForDeliveryOnly')}</p>
          <Input
            label={tc('deliveryAddress')}
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            required
          />
          <Input label={tc('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
