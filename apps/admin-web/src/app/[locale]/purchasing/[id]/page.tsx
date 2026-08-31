'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
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
  presentation?: {
    phase: string;
    labelKey: string;
    tone?: string;
    progress: number;
    attentionReason?: string | null;
    primaryAction?: string | null;
  };
  purchasingCosting?: {
    expectedTotal: number;
    actualReceivedValue: number;
    purchaseVariance: number;
  };
  lines?: Array<{
    id: string;
    description: string;
    quantity: string | number;
    unit?: string | null;
    unitPrice: string | number;
    lineTotal?: string | number;
    inventoryItemId?: string | null;
    receivedQty?: number | string;
    remainingQty?: number | string;
    inventoryItem?: {
      id: string;
      sku?: string;
      nameEn?: string;
      nameAr?: string;
      unit?: string | null;
      imageUrl?: string | null;
    } | null;
  }>;
  goodsReceipts?: Array<{
    id: string;
    number: string;
    createdAt?: string;
    notes?: string | null;
    lines?: Array<{
      id?: string;
      receivedQty?: number | string;
      rejectedQty?: number | string | null;
      unitCost?: number | string | null;
      inventoryItem?: { sku?: string; nameEn?: string; nameAr?: string } | null;
    }>;
  }>;
  supplierInvoices?: Array<{
    id: string;
    number: string;
    status: string;
    total?: string | number;
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType?: string | null;
    category?: string | null;
    sizeBytes?: number | null;
    createdAt?: string | null;
  }>;
  whatsappSentAt?: string | null;
  whatsappLastBody?: string | null;
  whatsappLastTo?: string | null;
}

interface Warehouse {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string;
  type?: string;
}

function phaseFallback(labelKey: string | undefined, phase: string | undefined): string {
  if (!labelKey && !phase) return '';
  const map: Record<string, string> = {
    'purchasing.phaseDraft': 'Draft',
    'purchasing.phaseOrdered': 'Ordered',
    'purchasing.phasePartial': 'Partially received',
    'purchasing.phaseReceived': 'Received',
    'purchasing.phaseClosed': 'Closed',
    'purchasing.phaseCancelled': 'Cancelled',
  };
  return (labelKey && map[labelKey]) || phase || labelKey || '';
}

export default function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const tc = useTranslations('catalog');
  const tPurchasing = useTranslations('purchasing');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [whatsappBody, setWhatsappBody] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({});
  const [unitCosts, setUnitCosts] = useState<Record<string, string>>({});
  const [rejectedQtys, setRejectedQtys] = useState<Record<string, string>>({});

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
      apiFetch<{
        purchaseOrder: { id: string };
        whatsapp: { ok: boolean; to: string | null; body: string };
      }>(`/api/v1/purchase-orders/${params.id}/send`, { method: 'POST' }),
    onSuccess: async (result) => {
      setSendOpen(false);
      setWhatsappBody(result.whatsapp.body);
      if (result.whatsapp.ok && result.whatsapp.to) {
        setBanner(tc('whatsappSentOk', { to: result.whatsapp.to }));
      } else if (!result.whatsapp.to) {
        setBanner(tc('whatsappNoPhone'));
      } else {
        setBanner(tc('whatsappSentFailed'));
      }
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
        .map((line) => {
          const remaining =
            line.remainingQty != null
              ? Number(line.remainingQty)
              : Math.max(0, Number(line.quantity) - Number(line.receivedQty ?? 0));
          const qty = Number(receivedQtys[line.id] ?? remaining) || 0;
          const unitCost =
            Number(unitCosts[line.id] ?? line.unitPrice) || Number(line.unitPrice) || 0;
          const rejectedQty = Number(rejectedQtys[line.id] ?? 0) || 0;
          return {
            inventoryItemId: line.inventoryItemId!,
            orderedQty: Number(line.quantity),
            receivedQty: qty,
            unitCost,
            ...(rejectedQty > 0 ? { rejectedQty } : {}),
          };
        })
        .filter((line) => line.receivedQty > 0);
      if (lines.length === 0) throw new Error(tc('selectInventoryItemRequired'));
      return apiFetch(`/api/v1/purchase-orders/${params.id}/goods-receipts`, {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: wh,
          idempotencyKey:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `grn-${params.id}-${Date.now()}`,
          lines,
        }),
      });
    },
    onSuccess: async () => {
      setReceiveOpen(false);
      setBanner(tc('goodsReceiptPosted'));
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['material-demand'] });
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['production-order'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  async function openAttachment(id: string) {
    try {
      const link = await apiFetch<{ downloadPath: string }>(
        `/api/v1/uploads/documents/${id}/link`,
      );
      window.open(`${API_URL}${link.downloadPath}`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(mutationErrorMessage(err));
    }
  }

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
      (warehousesQuery.data ?? [])
        .filter((w) => !w.type || w.type === 'RAW_MATERIALS')
        .map((w) => ({
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
  const canSend = po.status === 'APPROVED' || po.status === 'SENT';
  const canReceive = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status);
  const existingInvoice = (po.supplierInvoices ?? [])[0];
  const canCreateInvoice =
    !existingInvoice &&
    ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'].includes(po.status);
  const costing = po.purchasingCosting;
  const phaseKey = po.presentation?.labelKey?.replace(/^purchasing\./, '') as
    | 'phaseDraft'
    | 'phaseOrdered'
    | 'phasePartial'
    | 'phaseReceived'
    | 'phaseClosed'
    | 'phaseCancelled'
    | undefined;
  const phaseLabel = phaseKey
    ? tPurchasing(phaseKey)
    : phaseFallback(po.presentation?.labelKey, po.presentation?.phase);
  const progressPct = Math.round((Number(po.presentation?.progress) || 0) * 100);

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
            {phaseLabel ? (
              <StatusBadge
                status={po.presentation?.phase ?? po.status}
                label={`${phaseLabel}${progressPct > 0 ? ` · ${progressPct}%` : ''}`}
              />
            ) : (
              <StatusBadge status={po.status} />
            )}
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
                {po.status === 'SENT' ? tc('resendWhatsapp') : tc('sendPurchaseOrder')}
              </Button>
            ) : null}
            {canReceive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setWarehouseId(po.warehouseId ?? warehousesQuery.data?.[0]?.id ?? '');
                  setReceivedQtys(
                    Object.fromEntries(
                      lines.map((line) => {
                        const remaining =
                          line.remainingQty != null
                            ? Number(line.remainingQty)
                            : Math.max(
                                0,
                                Number(line.quantity) - Number(line.receivedQty ?? 0),
                              );
                        return [line.id, String(remaining)];
                      }),
                    ),
                  );
                  setUnitCosts(
                    Object.fromEntries(
                      lines.map((line) => [line.id, String(Number(line.unitPrice) || 0)]),
                    ),
                  );
                  setRejectedQtys(
                    Object.fromEntries(lines.map((line) => [line.id, ''])),
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
      {whatsappBody || po.whatsappLastBody ? (
        <Alert variant="info">
          <p className="font-medium">{tc('whatsappMessage')}</p>
          {(po.whatsappLastTo || null) && (
            <p className="text-sm text-text-secondary" dir="ltr">
              {po.whatsappLastTo}
            </p>
          )}
          <pre className="mt-2 whitespace-pre-wrap text-sm" dir="ltr">
            {whatsappBody || po.whatsappLastBody}
          </pre>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(whatsappBody || po.whatsappLastBody || '');
              setBanner(tc('copyWhatsapp'));
            }}
          >
            {tc('copyWhatsapp')}
          </Button>
        </Alert>
      ) : null}
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

      {costing ? (
        <MotionSection className="maher-form-section" as="div">
          <Card className="maher-list-card grid gap-4 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-text-secondary">{tc('expectedTotal')}</p>
              <p className="mt-1 font-semibold" dir="ltr">
                {Number(costing.expectedTotal).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">{tc('actualReceivedValue')}</p>
              <p className="mt-1 font-semibold" dir="ltr">
                {Number(costing.actualReceivedValue).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">{tc('purchaseVariance')}</p>
              <p
                className={`mt-1 font-semibold ${
                  Number(costing.purchaseVariance) > 0
                    ? 'text-amber-700'
                    : Number(costing.purchaseVariance) < 0
                      ? 'text-emerald-700'
                      : ''
                }`}
                dir="ltr"
              >
                {Number(costing.purchaseVariance).toFixed(2)}
              </p>
            </div>
          </Card>
        </MotionSection>
      ) : null}

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
                <TableHeaderCell>{tc('receivedQty')}</TableHeaderCell>
                <TableHeaderCell>{tc('remainingQty')}</TableHeaderCell>
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
                const received = Number(line.receivedQty ?? 0);
                const remaining =
                  line.remainingQty != null
                    ? Number(line.remainingQty)
                    : Math.max(0, Number(line.quantity) - received);
                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <InventoryItemThumb
                          src={line.inventoryItem?.imageUrl}
                          alt={name}
                          size={36}
                        />
                        <span>{name}</span>
                      </span>
                    </TableCell>
                    <TableNumericCell>{Number(line.quantity)}</TableNumericCell>
                    <TableNumericCell>{received}</TableNumericCell>
                    <TableNumericCell>{remaining}</TableNumericCell>
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
          <ul className="space-y-3 text-sm">
            {(po.goodsReceipts ?? []).map((grn) => (
              <li key={grn.id} className="rounded-xl border border-border p-3">
                <div className="flex justify-between gap-3">
                  <span className="font-medium" dir="ltr">
                    {grn.number}
                  </span>
                  <span className="text-text-secondary" dir="ltr">
                    {grn.createdAt?.slice(0, 10) ?? '—'}
                  </span>
                </div>
                {(grn.lines ?? []).length > 0 ? (
                  <ul className="mt-2 space-y-1 text-text-secondary">
                    {grn.lines!.map((gl, idx) => (
                      <li key={gl.id ?? `${grn.id}-${idx}`} dir="ltr">
                        {(gl.inventoryItem
                          ? localizedName(locale, gl.inventoryItem)
                          : '') || '—'}{' '}
                        × {Number(gl.receivedQty ?? 0)}
                        {Number(gl.rejectedQty ?? 0) > 0
                          ? ` (−${Number(gl.rejectedQty)} ${tc('rejectedQty')})`
                          : ''}
                        {gl.unitCost != null
                          ? ` @ ${Number(gl.unitCost).toFixed(2)}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">{tc('attachments')}</h2>
        {(po.attachments ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">{tc('noAttachments')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {(po.attachments ?? []).map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    className="truncate text-sm font-medium text-brand hover:underline"
                    onClick={() => void openAttachment(doc.id)}
                  >
                    {doc.fileName}
                  </button>
                  <p className="mt-0.5 text-xs text-text-tertiary" dir="ltr">
                    {[
                      doc.category?.split(':')[0],
                      doc.createdAt?.slice(0, 10),
                      doc.sizeBytes != null
                        ? `${Math.max(1, Math.round(Number(doc.sizeBytes) / 1024))} KB`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void openAttachment(doc.id)}
                >
                  {tCommon('details')}
                </Button>
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
            .map((line) => {
              const remaining =
                line.remainingQty != null
                  ? Number(line.remainingQty)
                  : Math.max(0, Number(line.quantity) - Number(line.receivedQty ?? 0));
              return (
                <div key={line.id} className="flex flex-wrap items-start gap-3">
                  <InventoryItemThumb
                    src={line.inventoryItem?.imageUrl}
                    alt={line.description}
                    size={36}
                    className="mt-6"
                  />
                  <div className="min-w-[140px] flex-1 space-y-1">
                    <p className="text-sm font-medium">{line.description}</p>
                    <p className="text-xs text-text-secondary" dir="ltr">
                      {tc('receivedQty')}: {Number(line.receivedQty ?? 0)} · {tc('remainingQty')}:{' '}
                      {remaining}
                    </p>
                  </div>
                  <Input
                    label={`${tc('qty')}`}
                    type="number"
                    value={receivedQtys[line.id] ?? ''}
                    onChange={(e) =>
                      setReceivedQtys((prev) => ({ ...prev, [line.id]: e.target.value }))
                    }
                    className="w-28"
                  />
                  <Input
                    label={tc('unitCost')}
                    type="number"
                    value={unitCosts[line.id] ?? ''}
                    onChange={(e) =>
                      setUnitCosts((prev) => ({ ...prev, [line.id]: e.target.value }))
                    }
                    className="w-32"
                  />
                  <Input
                    label={tc('rejectedQty')}
                    type="number"
                    value={rejectedQtys[line.id] ?? ''}
                    onChange={(e) =>
                      setRejectedQtys((prev) => ({ ...prev, [line.id]: e.target.value }))
                    }
                    className="w-28"
                  />
                </div>
              );
            })}
        </div>
      </Modal>
    </div>
  );
}
