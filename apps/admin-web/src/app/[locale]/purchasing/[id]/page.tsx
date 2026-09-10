'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { buildReceivePayload, isFabricCategory } from '@/lib/purchase-order-payload';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  NumberStepper,
  Select,
  Skeleton,
  StatusBadge,
  TextArea,
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
  origin?: string | null;
  total?: string | number;
  subtotal?: string | number;
  taxAmount?: string | number;
  notes?: string | null;
  warehouseId?: string | null;
  warehouse?: { id: string; code: string; nameEn?: string; nameAr?: string } | null;
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
    warehouseId?: string | null;
    locationId?: string | null;
    warehouse?: { id: string; code: string; nameEn?: string; nameAr?: string } | null;
    location?: { id: string; code: string; name?: string | null } | null;
    inventoryItem?: {
      id: string;
      sku?: string;
      nameEn?: string;
      nameAr?: string;
      unit?: string | null;
      category?: string | null;
      imageUrl?: string | null;
    } | null;
  }>;
  goodsReceipts?: Array<{
    id: string;
    number: string;
    createdAt?: string;
    notes?: string | null;
    warehouse?: { id: string; code: string; nameEn?: string; nameAr?: string } | null;
    lines?: Array<{
      id?: string;
      receivedQty?: number | string;
      rejectedQty?: number | string | null;
      unitCost?: number | string | null;
      location?: { id: string; code: string; name?: string | null } | null;
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
  locations?: Array<{
    id: string;
    code: string;
    name?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  }>;
}

function locationsForWarehouse(warehouses: Warehouse[], warehouseId?: string) {
  return (warehouses.find((w) => w.id === warehouseId)?.locations ?? []).filter(
    (loc) => loc.isActive !== false,
  );
}

function defaultLocationId(warehouses: Warehouse[], warehouseId?: string, current?: string) {
  const locs = locationsForWarehouse(warehouses, warehouseId);
  if (current && locs.some((loc) => loc.id === current)) return current;
  return locs.find((loc) => loc.isDefault)?.id ?? locs[0]?.id ?? '';
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
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [whatsappDraftTo, setWhatsappDraftTo] = useState<string | null>(null);
  const [whatsappDraftBody, setWhatsappDraftBody] = useState('');
  const [whatsappTemplateBody, setWhatsappTemplateBody] = useState('');
  const [whatsappBody, setWhatsappBody] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveConfirmOpen, setReceiveConfirmOpen] = useState(false);
  const [lineWarehouses, setLineWarehouses] = useState<Record<string, string>>({});
  const [lineLocations, setLineLocations] = useState<Record<string, string>>({});
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({});
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
      }>(`/api/v1/purchase-orders/${params.id}/send`, {
        method: 'POST',
        body: JSON.stringify({ body: whatsappDraftBody || undefined }),
      }),
    onSuccess: async (result) => {
      setSendOpen(false);
      setSendConfirmOpen(false);
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
      const payload = buildReceivePayload(
        (po.lines ?? [])
          .filter((line) => line.inventoryItemId)
          .map((line) => ({
            inventoryItemId: line.inventoryItemId!,
            orderedQty: Number(line.quantity),
            receiveNow: receivedQtys[line.id] ?? '0',
            rejectedQty: rejectedQtys[line.id] ?? '0',
            warehouseId: lineWarehouses[line.id] || po.warehouseId || undefined,
            locationId: lineLocations[line.id] || undefined,
          })),
      );
      if (payload.lines.length === 0) throw new Error(tc('selectInventoryItemRequired'));
      const fallbackWarehouse =
        payload.lines[0]?.warehouseId || po.warehouseId || warehousesQuery.data?.[0]?.id;
      if (!fallbackWarehouse) throw new Error(tc('selectWarehouseRequired'));
      return apiFetch(`/api/v1/purchase-orders/${params.id}/goods-receipts`, {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: fallbackWarehouse,
          idempotencyKey:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `grn-${params.id}-${Date.now()}`,
          ...payload,
        }),
      });
    },
    onSuccess: async () => {
      setReceiveOpen(false);
      setReceiveConfirmOpen(false);
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
            {po.origin && po.origin !== 'MANUAL' ? <StatusBadge status={po.origin} /> : null}
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
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const draft = await apiFetch<{ to: string | null; body: string }>(
                      `/api/v1/purchase-orders/${params.id}/whatsapp-draft`,
                      { method: 'POST' },
                    );
                    setWhatsappDraftTo(draft.to);
                    setWhatsappDraftBody(draft.body);
                    setWhatsappTemplateBody(draft.body);
                    setSendOpen(true);
                  } catch (err) {
                    setError(mutationErrorMessage(err));
                  }
                }}
              >
                {po.status === 'SENT' ? tc('resendWhatsapp') : tc('sendPurchaseOrder')}
              </Button>
            ) : null}
            {canReceive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setLineWarehouses(
                    Object.fromEntries(
                      lines.map((line) => [
                        line.id,
                        line.warehouseId ?? po.warehouseId ?? warehousesQuery.data?.[0]?.id ?? '',
                      ]),
                    ),
                  );
                  setLineLocations(
                    Object.fromEntries(
                      lines.map((line) => {
                        const warehouseId =
                          line.warehouseId ?? po.warehouseId ?? warehousesQuery.data?.[0]?.id ?? '';
                        return [
                          line.id,
                          defaultLocationId(
                            warehousesQuery.data ?? [],
                            warehouseId,
                            line.locationId ?? '',
                          ),
                        ];
                      }),
                    ),
                  );
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
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(whatsappBody || po.whatsappLastBody || '');
                setBanner(tc('copyWhatsapp'));
              }}
            >
              {tc('copyWhatsapp')}
            </Button>
            {canSend ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    const draft = await apiFetch<{ to: string | null; body: string }>(
                      `/api/v1/purchase-orders/${params.id}/whatsapp-draft`,
                      { method: 'POST' },
                    );
                    setWhatsappDraftTo(draft.to);
                    setWhatsappDraftBody(po.whatsappLastBody || draft.body);
                    setWhatsappTemplateBody(draft.body);
                    setSendOpen(true);
                  } catch (err) {
                    setError(mutationErrorMessage(err));
                  }
                }}
              >
                {tc('resendWhatsapp')}
              </Button>
            ) : null}
          </div>
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
                <TableHeaderCell>{tPurchasing('destination')}</TableHeaderCell>
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
                    <TableCell>
                      {(() => {
                        const warehouse = line.warehouse ?? po.warehouse;
                        if (!warehouse) return '—';
                        return `${warehouse.code}${line.location ? ` · ${line.location.code}` : ''}`;
                      })()}
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
                    {grn.warehouse ? ` · ${grn.warehouse.code}` : ''}
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
                        {gl.location?.code ? ` · ${gl.location.code}` : ''}
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

      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title={tPurchasing('whatsappPreview')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setWhatsappDraftBody(whatsappTemplateBody)}>
              {tPurchasing('resetTemplate')}
            </Button>
            <Button variant="secondary" onClick={() => setSendOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={() => setSendConfirmOpen(true)}>{tc('sendWhatsApp')}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {whatsappDraftTo ? (
            <p className="text-sm text-text-secondary" dir="ltr">
              {whatsappDraftTo}
            </p>
          ) : (
            <p className="text-sm text-text-secondary">{tc('whatsappNoPhone')}</p>
          )}
          <TextArea
            label={tc('whatsappMessage')}
            value={whatsappDraftBody}
            onChange={(e) => setWhatsappDraftBody(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={sendConfirmOpen}
        title={tc('sendPurchaseOrder')}
        description={tc('sendPurchaseOrderConfirm')}
        confirmLabel={tc('sendPurchaseOrder')}
        loading={sendMutation.isPending}
        error={error}
        onConfirm={() => sendMutation.mutate()}
        onClose={() => setSendConfirmOpen(false)}
      />

      <Modal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title={tc('goodsReceipts')}
        className="max-w-3xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiveOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={() => setReceiveConfirmOpen(true)}>{tCommon('save')}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {lines
            .filter((line) => line.inventoryItemId)
            .map((line) => {
              const remaining =
                line.remainingQty != null
                  ? Number(line.remainingQty)
                  : Math.max(0, Number(line.quantity) - Number(line.receivedQty ?? 0));
              const fabric = isFabricCategory(line.inventoryItem?.category);
              const warehouseId = lineWarehouses[line.id] ?? '';
              const locations = locationsForWarehouse(warehousesQuery.data ?? [], warehouseId);
              return (
                <div key={line.id} className="space-y-3 rounded-xl border border-border p-3">
                  <div className="flex items-start gap-3">
                    <InventoryItemThumb
                      src={line.inventoryItem?.imageUrl}
                      alt={line.description}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{line.description}</p>
                      <p className="text-xs text-text-secondary" dir="ltr">
                        {tc('receivedQty')}: {Number(line.receivedQty ?? 0)} · {tc('remainingQty')}:{' '}
                        {remaining}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberStepper
                      label={tc('qty')}
                      value={receivedQtys[line.id] ?? ''}
                      min={0}
                      max={remaining}
                      onChange={(value) =>
                        setReceivedQtys((prev) => ({ ...prev, [line.id]: value }))
                      }
                    />
                    <div className="space-y-1">
                      <p className="text-xs text-text-secondary">{tc('unitCost')}</p>
                      <p className="text-sm" dir="ltr">
                        {Number(line.unitPrice).toFixed(2)}
                      </p>
                    </div>
                    <NumberStepper
                      label={tc('rejectedQty')}
                      value={rejectedQtys[line.id] ?? ''}
                      min={0}
                      onChange={(value) =>
                        setRejectedQtys((prev) => ({ ...prev, [line.id]: value }))
                      }
                    />
                    <Select
                      label={tPurchasing('destination')}
                      value={warehouseId}
                      onChange={(e) => {
                        const next = e.target.value;
                        setLineWarehouses((prev) => ({ ...prev, [line.id]: next }));
                        setLineLocations((prev) => ({
                          ...prev,
                          [line.id]: defaultLocationId(warehousesQuery.data ?? [], next),
                        }));
                      }}
                      options={warehouseOptions}
                    />
                    <Select
                      label={fabric ? tPurchasing('holdingLocation') : tPurchasing('bin')}
                      value={lineLocations[line.id] ?? ''}
                      onChange={(e) =>
                        setLineLocations((prev) => ({ ...prev, [line.id]: e.target.value }))
                      }
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.code}
                          {loc.name ? ` — ${loc.name}` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              );
            })}
        </div>
      </Modal>
      <ConfirmDialog
        open={receiveConfirmOpen}
        title={tc('goodsReceipts')}
        description={tc('goodsReceiptPosted')}
        confirmLabel={tCommon('save')}
        loading={receiveMutation.isPending}
        error={error}
        onConfirm={() => receiveMutation.mutate()}
        onClose={() => setReceiveConfirmOpen(false)}
      />
    </div>
  );
}
