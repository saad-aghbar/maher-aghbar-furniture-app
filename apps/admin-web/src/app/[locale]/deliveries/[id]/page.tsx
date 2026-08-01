'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { DELIVERY_STATUSES } from '@/lib/status-options';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';

interface DeliveryItem {
  id: string;
  description: string;
  quantity: string | number;
}

interface DeliveryDetail {
  id: string;
  number: string;
  status: string;
  deliveryAddress: string;
  notes?: string | null;
  recipientName?: string | null;
  failureReason?: string | null;
  signatureData?: string | null;
  customer?: { name: string; phone?: string | null };
  driver?: { firstName?: string; lastName?: string } | null;
  items?: DeliveryItem[];
}

const STATUS_FLOW = ['PLANNED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

function nextStatus(current: string): string | null {
  const i = STATUS_FLOW.indexOf(current as (typeof STATUS_FLOW)[number]);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1]!;
}

function canvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export default function DeliveryDetailPage({ params }: { params: { id: string } }) {
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const [banner, setBanner] = useState<string | null>(null);
  const [podOpen, setPodOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [driverId, setDriverId] = useState('');

  const detailQuery = useQuery({
    queryKey: ['delivery', params.id],
    queryFn: () => apiFetch<DeliveryDetail>(`/api/v1/deliveries/${params.id}`),
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

  const statusMutation = useMutation({
    mutationFn: (args: {
      status: string;
      recipientName?: string;
      signatureData?: string;
      photoDocumentId?: string;
      driverId?: string;
      failureReason?: string;
      notes?: string;
    }) =>
      apiFetch(`/api/v1/deliveries/${params.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(args),
      }),
    onSuccess: async () => {
      setFormError(null);
      setPodOpen(false);
      setFailOpen(false);
      setBanner(tc('deliveryStatusUpdated'));
      await queryClient.invalidateQueries({ queryKey: ['delivery', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDraw = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    const { x, y } = canvasPoint(canvas, clientX, clientY);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveDraw = (clientX: number, clientY: number) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = canvasPoint(canvas, clientX, clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  async function completeWithPod() {
    if (!recipientName.trim()) {
      setFormError(tc('recipientNameRequired'));
      return;
    }
    const canvas = canvasRef.current;
    const signatureData = canvas?.toDataURL('image/png');
    let photoDocumentId: string | undefined;
    const fileInput = document.getElementById('pod-photo-detail') as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (file) {
      const form = new FormData();
      form.append('file', file);
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/api/v1/uploads?category=POD`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new ApiClientError(tCommon('uploadFailed'), res.status);
      const json = (await res.json()) as { document: { id: string } };
      photoDocumentId = json.document.id;
    }
    statusMutation.mutate({
      status: 'DELIVERED',
      recipientName: recipientName.trim(),
      signatureData,
      photoDocumentId,
    });
  }

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
        title={tc('deliveryDetail')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const delivery = detailQuery.data;
  const items = delivery.items ?? [];
  const next = nextStatus(delivery.status);
  const terminal = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(delivery.status);
  const driverName = delivery.driver
    ? [delivery.driver.firstName, delivery.driver.lastName].filter(Boolean).join(' ')
    : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title={delivery.number}
        description={delivery.customer?.name}
        actions={
          <Link href="/deliveries" className="text-sm text-brand hover:underline">
            {tc('backToList')}
          </Link>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {formError && !podOpen && !failOpen ? <Alert variant="error">{formError}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={delivery.status} />
        <span className="text-sm text-text-secondary">{delivery.deliveryAddress}</span>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">{tCommon('status')}</h2>
        <div className="flex flex-wrap gap-2">
          {DELIVERY_STATUSES.map((status) => {
            const reached =
              STATUS_FLOW.indexOf(delivery.status as (typeof STATUS_FLOW)[number]) >=
                STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]) ||
              delivery.status === status;
            return (
              <span
                key={status}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  delivery.status === status
                    ? 'border-brand bg-brand/10 font-semibold text-brand'
                    : reached && STATUS_FLOW.includes(status as (typeof STATUS_FLOW)[number])
                      ? 'border-border text-text-secondary'
                      : 'border-border/60 text-text-tertiary'
                }`}
              >
                {tStatus(status as never)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
        <p>
          {tc('recipientName')}: {delivery.recipientName ?? '—'}
        </p>
        <p>
          {tc('driver')}: {driverName}
        </p>
        {delivery.failureReason ? (
          <p>
            {tc('failureReason')}: {delivery.failureReason}
          </p>
        ) : null}
        {delivery.notes ? (
          <p>
            {tc('notes')}: {delivery.notes}
          </p>
        ) : null}
      </div>

      {delivery.signatureData ? (
        <div>
          <p className="mb-1 text-sm font-medium">{tc('signature')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={delivery.signatureData}
            alt={tc('signature')}
            className="max-h-32 rounded border border-border bg-white"
          />
        </div>
      ) : null}

      {!terminal ? (
        <div className="flex flex-wrap gap-2">
          {next === 'DELIVERED' ? (
            <Button
              onClick={() => {
                setRecipientName(delivery.recipientName ?? '');
                setFormError(null);
                setPodOpen(true);
                setTimeout(clearSignature, 50);
              }}
            >
              {tc('completePod')}
            </Button>
          ) : next ? (
            <Button
              loading={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({
                  status: next,
                  driverId: next === 'OUT_FOR_DELIVERY' ? driverId || undefined : undefined,
                })
              }
            >
              {tc('advanceTo', { status: tStatus(next as never) })}
            </Button>
          ) : null}
          {delivery.status !== 'FAILED' ? (
            <Button variant="danger" onClick={() => setFailOpen(true)}>
              {tc('markFailed')}
            </Button>
          ) : null}
          {next === 'OUT_FOR_DELIVERY' || delivery.status === 'READY' ? (
            <Select
              label={tc('defaultDriver')}
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="max-w-xs"
            >
              <option value="">{tc('currentUser')}</option>
              {(driversQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">{tCommon('items')}</h2>
        {items.length === 0 ? (
          <EmptyState title={tc('noLines')} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tc('description')}</TableHeaderCell>
                <TableHeaderCell>{tc('qty')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>
                    <span dir="ltr">{String(item.quantity)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        open={podOpen}
        onClose={() => setPodOpen(false)}
        title={tc('podTitle', { number: delivery.number })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPodOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={statusMutation.isPending} onClick={() => void completeWithPod()}>
              {tc('markDelivered')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input
            label={`${tc('recipientName')} *`}
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
          <div>
            <p className="mb-1 text-sm font-medium">{tc('signature')}</p>
            <canvas
              ref={canvasRef}
              width={420}
              height={140}
              className="w-full touch-none rounded border border-[var(--maher-border)] bg-white"
              onMouseDown={(e) => startDraw(e.clientX, e.clientY)}
              onMouseMove={(e) => moveDraw(e.clientX, e.clientY)}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                if (touch) startDraw(touch.clientX, touch.clientY);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                if (touch) moveDraw(touch.clientX, touch.clientY);
              }}
              onTouchEnd={endDraw}
              onTouchCancel={endDraw}
            />
            <Button size="sm" variant="ghost" className="mt-1" onClick={clearSignature}>
              {tc('clearSignature')}
            </Button>
          </div>
          <label className="block text-sm">
            {tc('photoOptional')}
            <input
              id="pod-photo-detail"
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-sm"
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={failOpen}
        onClose={() => setFailOpen(false)}
        title={tc('markFailed')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFailOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="danger"
              loading={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({
                  status: 'FAILED',
                  failureReason: failureReason.trim() || undefined,
                })
              }
            >
              {tc('markFailed')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input
            label={tc('failureReason')}
            value={failureReason}
            onChange={(e) => setFailureReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
