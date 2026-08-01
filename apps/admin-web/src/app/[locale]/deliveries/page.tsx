'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { DELIVERY_STATUSES, statusOptions } from '@/lib/status-options';
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
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

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
  customer?: {
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
}

const STATUS_FLOW = ['PLANNED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

function nextStatus(current: string): string | null {
  const i = STATUS_FLOW.indexOf(current as (typeof STATUS_FLOW)[number]);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1]!;
}

export default function DeliveriesPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [salesOrderId, setSalesOrderId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [driverId, setDriverId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [search, statusFilter]);

  const listQuery = useQuery({
    queryKey: ['deliveries', listParams],
    queryFn: () =>
      apiFetch<{ data: DeliveryRow[] }>(`/api/v1/deliveries?${listParams}`).then((r) => r.data),
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
            ['DELIVERY_EMPLOYEE', 'WAREHOUSE_EMPLOYEE', 'PRODUCTION_SUPERVISOR'].includes(
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

  const statusFilterOpts = statusOptions(tStatus, DELIVERY_STATUSES, {
    label: tCommon('all'),
  });

  const rows = listQuery.data ?? [];

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
      setBanner(tc('deliveryStatusUpdated'));
    },
    onError: (err) => setBanner(mutationErrorMessage(err)),
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
    return <ErrorState title={t('deliveries')} onRetry={() => listQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('deliveries')}
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

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tCommon('search')}
          leadingIcon={<Search className="h-4 w-4" />}
          className="max-w-xs"
        />
        <Select
          label={tCommon('status')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={statusFilterOpts}
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
      </div>

      {rows.length === 0 ? (
        <EmptyState title={tc('noDeliveries')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
              <TableHeaderCell>{tc('customer')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('address')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const next = nextStatus(row.status);
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
                  <TableCell>
                    {row.customer
                      ? localizedName(locale, row.customer, row.customer.name)
                      : '—'}
                  </TableCell>
                  <TableCell>{row.deliveryAddress}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
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
                          {tc('advanceTo', { status: tStatus(next as never) })}
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
        <div className="space-y-3">
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
