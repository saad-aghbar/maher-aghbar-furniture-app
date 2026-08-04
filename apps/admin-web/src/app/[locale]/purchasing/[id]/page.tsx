'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
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
  TableNumericCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  MotionSection,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface PoDetail {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  subtotal?: string | number;
  taxAmount?: string | number;
  notes?: string | null;
  warehouseId?: string | null;
  supplier?: { id: string; name: string; nameAr?: string; nameEn?: string; code?: string };
  lines?: Array<{
    id: string;
    description: string;
    quantity: string | number;
    unit?: string | null;
    unitPrice: string | number;
    lineTotal?: string | number;
    inventoryItemId?: string | null;
    inventoryItem?: {
      id: string;
      sku?: string;
      nameEn?: string;
      nameAr?: string;
      unit?: string | null;
    } | null;
  }>;
  goodsReceipts?: Array<{
    id: string;
    number: string;
    createdAt?: string;
    notes?: string | null;
  }>;
  supplierInvoices?: Array<{
    id: string;
    number: string;
    status: string;
    total?: string | number;
  }>;
}

interface Warehouse {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string;
}

export default function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({});

  const detailQuery = useQuery({
    queryKey: ['purchase-order', params.id],
    queryFn: () => apiFetch<PoDetail>(`/api/v1/purchase-orders/${params.id}`),
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-pick'],
    queryFn: () =>
      apiFetch<{ data: Warehouse[] }>('/api/v1/warehouses?pageSize=50').then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/purchase-orders/${params.id}/approve`, { method: 'POST' }),
    onSuccess: async () => {
      setApproveOpen(false);
      setBanner(tc('purchaseOrderApproved'));
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/purchase-orders/${params.id}/send`, { method: 'POST' }),
    onSuccess: async () => {
      setSendOpen(false);
      setBanner(tc('purchaseOrderSent'));
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const po = detailQuery.data;
      if (!po) throw new Error('missing');
      const wh = warehouseId || po.warehouseId;
      if (!wh) throw new Error(tc('selectWarehouseRequired'));
      const lines = (po.lines ?? [])
        .filter((line) => line.inventoryItemId)
        .map((line) => ({
          inventoryItemId: line.inventoryItemId!,
          orderedQty: Number(line.quantity),
          receivedQty: Number(receivedQtys[line.id] ?? line.quantity) || 0,
        }));
      if (lines.length === 0) throw new Error(tc('selectInventoryItemRequired'));
      return apiFetch(`/api/v1/purchase-orders/${params.id}/goods-receipts`, {
        method: 'POST',
        body: JSON.stringify({ warehouseId: wh, lines }),
      });
    },
    onSuccess: async () => {
      setReceiveOpen(false);
      setBanner(tc('goodsReceiptPosted'));
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/api/v1/supplier-invoices', {
        method: 'POST',
        body: JSON.stringify({ purchaseOrderId: params.id }),
      }),
    onSuccess: async (created) => {
      setBanner(tc('supplierInvoiceCreated'));
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      if (created?.id) router.push(`/purchasing/supplier-invoices/${created.id}`);
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const warehouseOptions = useMemo(
    () =>
      (warehousesQuery.data ?? []).map((w) => ({
        value: w.id,
        label: `${w.code} — ${localizedName(locale, w)}`,
      })),
    [warehousesQuery.data, locale],
  );

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
        title={tc('purchaseOrderDetail')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const po = detailQuery.data;
  const lines = po.lines ?? [];
  const canApprove = po.status === 'DRAFT' || po.status === 'PENDING_APPROVAL';
  const canSend = po.status === 'APPROVED';
  const canReceive = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status);
  const existingInvoice = (po.supplierInvoices ?? [])[0];
  const canCreateInvoice =
    !existingInvoice &&
    ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'].includes(po.status);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/purchasing"
        title={po.number}
        description={
          po.supplier
            ? localizedName(locale, po.supplier, po.supplier.name)
            : tNav('purchasing')
        }
        actions={
          <>
            <StatusBadge status={po.status} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(
                  `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/purchasing/orders/${po.id}/pdf`,
                  '_blank',
                )
              }
            >
              PDF
            </Button>
            <Link href="/purchasing">
              <Button variant="ghost" size="sm">
                {tCommon('back')}
              </Button>
            </Link>
            {canApprove ? (
              <Button onClick={() => setApproveOpen(true)}>{tc('approve')}</Button>
            ) : null}
            {canSend ? (
              <Button variant="secondary" onClick={() => setSendOpen(true)}>
                {tc('sendPurchaseOrder')}
              </Button>
            ) : null}
            {canReceive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setWarehouseId(po.warehouseId ?? warehousesQuery.data?.[0]?.id ?? '');
                  setReceivedQtys(
                    Object.fromEntries(
                      lines.map((line) => [line.id, String(line.quantity)]),
                    ),
                  );
                  setReceiveOpen(true);
                }}
              >
                {tc('goodsReceipts')}
              </Button>
            ) : null}
            {canCreateInvoice ? (
              <Button
                variant="secondary"
                loading={createInvoiceMutation.isPending}
                onClick={() => createInvoiceMutation.mutate()}
              >
                {tc('createSupplierInvoice')}
              </Button>
            ) : null}
            {existingInvoice ? (
              <Link href={`/purchasing/supplier-invoices/${existingInvoice.id}`}>
                <Button variant="ghost" size="sm">
                  {existingInvoice.number}
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="maher-stagger space-y-6">
      <div className="maher-stagger grid gap-4 md:grid-cols-3">
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tc('supplier')}</p>
          <p className="mt-1 font-semibold">
            {po.supplier ? localizedName(locale, po.supplier, po.supplier.name) : '—'}
          </p>
        </Card>
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tCommon('total')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {Number(po.total ?? 0).toFixed(2)}
          </p>
        </Card>
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tc('notes')}</p>
          <p className="mt-1 font-medium">{po.notes ?? '—'}</p>
        </Card>
      </div>

      <MotionSection className="maher-form-section" as="div">
      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">{tc('materialsList')}</h2>
        {lines.length === 0 ? (
          <EmptyState title={tc('selectMaterialRequired')} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tc('material')}</TableHeaderCell>
                <TableHeaderCell>{tc('qty')}</TableHeaderCell>
                <TableHeaderCell>{tc('unit')}</TableHeaderCell>
                <TableHeaderCell>{tc('unitPrice')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => {
                const unit = line.unit || line.inventoryItem?.unit || 'pcs';
                const name = line.inventoryItem
                  ? localizedName(locale, line.inventoryItem, line.description)
                  : line.description;
                return (
                  <TableRow key={line.id}>
                    <TableCell>{name}</TableCell>
                    <TableNumericCell>{Number(line.quantity)}</TableNumericCell>
                    <TableCell className="capitalize">{unit}</TableCell>
                    <TableNumericCell>{Number(line.unitPrice).toFixed(2)}</TableNumericCell>
                    <TableNumericCell>
                      {Number(
                        line.lineTotal ?? Number(line.quantity) * Number(line.unitPrice),
                      ).toFixed(2)}
                    </TableNumericCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">{tc('goodsReceipts')}</h2>
        {(po.goodsReceipts ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">—</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(po.goodsReceipts ?? []).map((grn) => (
              <li key={grn.id} className="flex justify-between gap-3">
                <span className="font-medium" dir="ltr">
                  {grn.number}
                </span>
                <span className="text-text-secondary" dir="ltr">
                  {grn.createdAt?.slice(0, 10) ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </MotionSection>
      </div>

      <ConfirmDialog
        open={approveOpen}
        title={tc('approvePurchaseOrder')}
        description={tc('approvePurchaseOrderConfirm')}
        confirmLabel={tc('approve')}
        loading={approveMutation.isPending}
        error={error}
        onConfirm={() => approveMutation.mutate()}
        onClose={() => setApproveOpen(false)}
      />

      <ConfirmDialog
        open={sendOpen}
        title={tc('sendPurchaseOrder')}
        description={tc('sendPurchaseOrderConfirm')}
        confirmLabel={tc('sendPurchaseOrder')}
        loading={sendMutation.isPending}
        error={error}
        onConfirm={() => sendMutation.mutate()}
        onClose={() => setSendOpen(false)}
      />

      <Modal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title={tc('goodsReceipts')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiveOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={receiveMutation.isPending} onClick={() => receiveMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label={tc('warehouses')}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            options={warehouseOptions}
          />
          {lines
            .filter((line) => line.inventoryItemId)
            .map((line) => (
              <Input
                key={line.id}
                label={`${line.description} (${tc('qty')})`}
                type="number"
                value={receivedQtys[line.id] ?? ''}
                onChange={(e) =>
                  setReceivedQtys((prev) => ({ ...prev, [line.id]: e.target.value }))
                }
              />
            ))}
        </div>
      </Modal>
    </div>
  );
}
