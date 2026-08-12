'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableNumericCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  MotionSection,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface CustomerRequestItem {
  id: string;
  productName: string;
  description?: string | null;
  quantity: string | number;
  unit?: string | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  material?: string | null;
  fabricType?: string | null;
  fabricColor?: string | null;
  woodType?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  accessories?: string | null;
  notes?: string | null;
}

interface CustomerRequest {
  id?: string;
  number?: string;
  source?: string;
  projectName?: string | null;
  contactName?: string | null;
  notes?: string | null;
  deliveryAddress?: string | null;
  requiredDeliveryDate?: string | null;
  externalOrderNumber?: string | null;
  endCustomerName?: string | null;
  endCustomerPhone?: string | null;
  endCustomerFax?: string | null;
  priority?: string | null;
  items?: CustomerRequestItem[];
  documents?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    storageKey: string;
  }>;
  originalText?: string | null;
  translatedText?: string | null;
  detectedLanguage?: string | null;
  targetLanguage?: string | null;
}

interface SalesOrderDetail {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  manufacturingCost?: string | number | null;
  sellerPrice?: string | number | null;
  productionPrice?: string | number | null;
  profit?: string | number | null;
  costBreakdown?: Record<string, number> | null;
  projectName?: string | null;
  requiredDeliveryDate?: string | null;
  requestedDeliveryDate?: string | null;
  deliveryAddress?: string | null;
  externalOrderNumber?: string | null;
  notes?: string | null;
  customer?: {
    id: string;
    name: string;
    code?: string;
    phone?: string;
    fax?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  quotation?: { id: string; number: string; status: string } | null;
  customerRequest?: CustomerRequest | null;
  orderedItems?: CustomerRequestItem[];
  productionOrders?: Array<{
    id: string;
    number: string;
    status: string;
    progressPercent?: number | null;
    currentStageCode?: string | null;
  }>;
  invoices?: Array<{
    id: string;
    number: string;
    status: string;
    total?: string | number;
    outstandingAmount?: string | number;
  }>;
  deliveries?: Array<{
    id: string;
    number: string;
    status: string;
    deliveryDate?: string | null;
  }>;
  returns?: Array<{
    id: string;
    number: string;
    approvalStatus: string;
    reason: string;
    productDesc: string;
    quantity?: string | number;
  }>;
}

const HOLDABLE = [
  'CONFIRMED',
  'READY_FOR_PRODUCTION',
  'IN_PRODUCTION',
  'WAITING_FOR_MATERIALS',
  'WAITING_FOR_PAYMENT',
];
const CANCELLABLE = [
  'DRAFT',
  'CONFIRMED',
  'READY_FOR_PRODUCTION',
  'ON_HOLD',
  'WAITING_FOR_PAYMENT',
  'WAITING_FOR_MATERIALS',
];

function dim(item: CustomerRequestItem) {
  const parts = [item.width, item.height, item.depth]
    .map((v) => (v != null && String(v) !== '' ? String(v) : null))
    .filter(Boolean);
  return parts.length ? parts.join(' × ') : null;
}

export default function SalesOrderDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tCustomers = useTranslations('customers');
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['sales-order', params.id],
    queryFn: () => apiFetch<SalesOrderDetail>(`/api/v1/sales-orders/${params.id}`),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/sales-orders/${params.id}/confirm`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setConfirmOpen(false);
      setBanner(tSales('confirmedBanner'));
      await queryClient.invalidateQueries({ queryKey: ['sales-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const holdMutation = useMutation({
    mutationFn: (reason?: string) =>
      apiFetch(`/api/v1/sales-orders/${params.id}/hold`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      setError(null);
      setHoldOpen(false);
      setBanner(tSales('heldBanner'));
      await queryClient.invalidateQueries({ queryKey: ['sales-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) =>
      apiFetch(`/api/v1/sales-orders/${params.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      setError(null);
      setCancelOpen(false);
      setBanner(tSales('cancelledBanner'));
      await queryClient.invalidateQueries({ queryKey: ['sales-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title={tSales('detail')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const order = detailQuery.data;
  const customerName = order.customer
    ? localizedName(locale, order.customer, order.customer.name)
    : undefined;
  const req = order.customerRequest;
  const items = req?.items?.length ? req.items : order.orderedItems ?? [];
  const cb = order.costBreakdown ?? {};
  const seller = Number(order.sellerPrice ?? order.total ?? 0);
  const production = Number(order.productionPrice ?? order.manufacturingCost ?? 0);
  const profit = Number(order.profit ?? seller - production);
  const deliveryDate =
    order.requiredDeliveryDate?.slice(0, 10) ??
    order.requestedDeliveryDate?.slice(0, 10) ??
    req?.requiredDeliveryDate?.slice(0, 10) ??
    '—';
  const dealerOrderNo =
    order.externalOrderNumber?.trim() || req?.externalOrderNumber?.trim() || '—';

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/orders"
        title={order.number}
        description={customerName}
        actions={
          <div className="maher-detail-sticky-actions flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            {order.status === 'DRAFT' ? (
              <Button onClick={() => setConfirmOpen(true)}>{tSales('confirm')}</Button>
            ) : null}
            {HOLDABLE.includes(order.status) ? (
              <Button variant="secondary" onClick={() => setHoldOpen(true)}>
                {tSales('hold')}
              </Button>
            ) : null}
            {CANCELLABLE.includes(order.status) ? (
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                {tSales('cancelOrder')}
              </Button>
            ) : null}
          </div>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="maher-stagger space-y-6">
      <div className="maher-stagger grid gap-3 sm:grid-cols-2">
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tSales('systemOrderNumber')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {order.number}
          </p>
        </Card>
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tSales('dealerOrderNumber')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {dealerOrderNo}
          </p>
        </Card>
      </div>

      <div className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tSales('customer')}</p>
          <p className="mt-1 font-semibold">
            {order.customer ? (
              <Link href={`/customers/${order.customer.id}`} className="text-brand hover:underline">
                {customerName}
              </Link>
            ) : (
              '—'
            )}
          </p>
        </Card>
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tSales('sellerPrice')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {seller.toFixed(2)} {tCommon('currency')}
          </p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">{tSales('autoCalculated')}</p>
        </Card>
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tSales('productionPrice')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {production.toFixed(2)} {tCommon('currency')}
          </p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">{tSales('fromInventoryCosts')}</p>
        </Card>
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tSales('profit')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {profit.toFixed(2)} {tCommon('currency')}
          </p>
        </Card>
      </div>

      <MotionSection className="maher-form-section" as="div">
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{tSales('customerOrder')}</h2>
          {req?.source ? <StatusBadge status={req.source} /> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-text-tertiary">{tSales('endCustomer')}</p>
            <p className="font-medium">{req?.endCustomerName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">{tSales('phone')}</p>
            <p className="font-medium" dir="ltr">
              {req?.endCustomerPhone ?? order.customer?.phone ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">{tCustomers('fax')}</p>
            <p className="font-medium" dir="ltr">
              {req?.endCustomerFax ?? order.customer?.fax ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">{tSales('deliveryDate')}</p>
            <p className="font-medium" dir="ltr">
              {deliveryDate}
            </p>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs text-text-tertiary">{tSales('deliveryAddress')}</p>
            <p className="font-medium">
              {req?.deliveryAddress ?? order.deliveryAddress ?? '—'}
            </p>
          </div>
          {req?.projectName || order.projectName ? (
            <div>
              <p className="text-xs text-text-tertiary">{tSales('project')}</p>
              <p className="font-medium">{req?.projectName ?? order.projectName}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{tSales('whatTheyOrdered')}</h3>
          {items.length === 0 ? (
            <p className="text-sm text-text-secondary">{tSales('noCustomerItems')}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-[var(--maher-surface-muted)]/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-text-primary">{item.productName}</p>
                    <p className="text-sm tabular-nums text-text-secondary" dir="ltr">
                      × {Number(item.quantity)}
                    </p>
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
                    {dim(item) ? <span dir="ltr">{dim(item)}</span> : null}
                    {item.fabricType ? (
                      <span>
                        {tSales('fabric')}: {item.fabricType}
                        {item.fabricColor ? ` / ${item.fabricColor}` : ''}
                      </span>
                    ) : null}
                    {item.material ? (
                      <span>
                        {tSales('material')}: {item.material}
                      </span>
                    ) : null}
                    {item.woodType ? <span>{item.woodType}</span> : null}
                    {item.foamDensity ? <span>{item.foamDensity}</span> : null}
                    {item.finish ? <span>{item.finish}</span> : null}
                    {item.accessories ? <span>{item.accessories}</span> : null}
                  </div>
                  {item.notes ? <p className="mt-2 text-sm text-text-secondary">{item.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {(req?.translatedText || req?.originalText || req?.notes) && (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">{tSales('customerNotes')}</h3>
            {req?.detectedLanguage ? (
              <p className="text-xs text-text-tertiary">
                {tSales('detectedLanguage')}: {req.detectedLanguage}
                {req.targetLanguage ? ` → ${req.targetLanguage}` : ''}
              </p>
            ) : null}
            {req?.translatedText ? (
              <p className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-3 text-sm">
                {req.translatedText}
              </p>
            ) : req?.notes ? (
              <p className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-3 text-sm">
                {req.notes}
              </p>
            ) : null}
            {req?.originalText && req.originalText !== req.translatedText ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-text-secondary">
                  {tSales('originalHandwriting')}
                </summary>
                <p className="mt-2 whitespace-pre-wrap rounded-xl border border-dashed border-border p-3 text-text-secondary">
                  {req.originalText}
                </p>
              </details>
            ) : null}
          </div>
        )}

        {(req?.documents?.length ?? 0) > 0 ? (
          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold">{tSales('attachments')}</h3>
            <ul className="space-y-1 text-sm">
              {req!.documents!.map((doc) => (
                <li key={doc.id} className="text-text-secondary">
                  {doc.fileName}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-base font-semibold">{tSales('manufacturingCost')}</h2>
          <p className="text-xs text-text-tertiary">{tSales('fromInventoryCosts')}</p>
        </div>
        <p className="text-2xl font-bold tracking-tight" dir="ltr">
          {production.toFixed(2)} <span className="text-base font-medium text-text-secondary">{tCommon('currency')}</span>
        </p>
        <div className="maher-stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['fabric', tSales('fabricCost'), cb.fabricQty, cb.fabricCost],
              ['wood', tSales('woodCost'), cb.woodQty, cb.woodCost],
              ['foam', tSales('foamCost'), cb.foamQty, cb.foamCost],
              ['accessories', tSales('accessoriesCost'), cb.accessoriesQty, cb.accessoriesCost],
            ] as const
          ).map(([key, label, qty, cost]) => (
            <div key={key} className="maher-list-card rounded-xl border border-border p-3">
              <p className="text-xs text-text-tertiary">{label}</p>
              <p className="mt-1 font-semibold" dir="ltr">
                {cost != null ? Number(cost).toFixed(2) : '0.00'} {tCommon('currency')}
              </p>
              {qty != null && Number(qty) > 0 ? (
                <p className="text-[11px] text-text-tertiary" dir="ltr">
                  qty {Number(qty)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
      </MotionSection>

      <LinkedSection
        title={tSales('linkedProduction')}
        empty={tSales('noProductionYet')}
        rows={(order.productionOrders ?? []).map((po) => ({
          id: po.id,
          href: `/production/${po.id}`,
          number: po.number,
          status: po.status,
          meta: po.progressPercent != null ? `${Number(po.progressPercent)}%` : undefined,
        }))}
      />

      <LinkedSection
        title={tSales('linkedInvoices')}
        empty={tNav('invoices')}
        rows={(order.invoices ?? []).map((inv) => ({
          id: inv.id,
          href: `/invoices/${inv.id}`,
          number: inv.number,
          status: inv.status,
          meta: inv.total != null ? Number(inv.total).toFixed(2) : undefined,
        }))}
      />

      <LinkedSection
        title={tSales('linkedDeliveries')}
        empty={tNav('deliveries')}
        rows={(order.deliveries ?? []).map((d) => ({
          id: d.id,
          href: `/deliveries/${d.id}`,
          number: d.number,
          status: d.status,
          meta: d.deliveryDate?.slice(0, 10),
        }))}
      />

      <LinkedSection
        title={tSales('linkedReturns')}
        empty={tSales('noLinkedReturns')}
        rows={(order.returns ?? []).map((r) => ({
          id: r.id,
          href: '/returns',
          number: r.number,
          status: r.approvalStatus,
          meta: r.productDesc,
        }))}
      />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={tSales('confirm')}
        description={tSales('confirmDescription')}
        confirmLabel={tSales('confirm')}
        loading={confirmMutation.isPending}
        error={error}
        onConfirm={() => confirmMutation.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={holdOpen}
        title={tSales('hold')}
        description={tSales('holdDescription')}
        confirmLabel={tSales('hold')}
        withReason
        reasonLabel={tCommon('reason')}
        loading={holdMutation.isPending}
        error={error}
        onConfirm={(reason) => holdMutation.mutate(reason)}
        onClose={() => setHoldOpen(false)}
      />
      <ConfirmDialog
        open={cancelOpen}
        title={tSales('cancelOrder')}
        description={tSales('cancelDescription')}
        confirmLabel={tSales('cancelOrder')}
        danger
        withReason
        reasonLabel={tCommon('reason')}
        loading={cancelMutation.isPending}
        error={error}
        onConfirm={(reason) => cancelMutation.mutate(reason)}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  );
}

function LinkedSection({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; href: string; number: string; status: string; meta?: string }>;
}) {
  const tCommon = useTranslations('common');
  return (
    <MotionSection className="maher-form-section" as="div">
    <Card className="space-y-3 p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{empty}</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('details')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={row.href} className="font-medium text-brand hover:underline">
                    {row.number}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableNumericCell>{row.meta ?? '—'}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
    </MotionSection>
  );
}
