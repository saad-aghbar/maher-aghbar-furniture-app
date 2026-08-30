'use client';

import { BackButton } from '@/components/back-button';
import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import {
  Alert,
  Button,
  Card,
  MotionSection,
  PageHero,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { dealerCanDecideQuotation } from '@/lib/dealer-quotation-ui';

interface QuoteLine {
  id: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
  material?: string | null;
  fabric?: string | null;
  color?: string | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  discountValue?: string | number | null;
}

interface Quotation {
  id: string;
  number: string;
  status: string;
  version?: number;
  total: string | number;
  subtotal?: string | number | null;
  discountTotal?: string | number | null;
  taxTotal?: string | number | null;
  taxAmount?: string | number | null;
  currency?: string;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  customerNotes?: string | null;
  expirationDate?: string | null;
  acceptanceSignature?: string | null;
  lines: QuoteLine[];
  salesOrders?: Array<{ id: string; number: string; status: string }>;
}

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('quotations');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quotation', params.id],
    queryFn: () => apiFetch<Quotation>(`/api/v1/quotations/${params.id}`),
  });

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !drawing) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]!.clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1c1917';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function signatureData(): string | undefined {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) return undefined;
    return canvas.toDataURL('image/png');
  }

  async function act(path: 'accept' | 'reject' | 'request-revision') {
    setLoading(true);
    setError(null);
    try {
      const body =
        path === 'accept'
          ? JSON.stringify({ signatureData: signatureData() })
          : path === 'request-revision'
            ? JSON.stringify({ comment: revisionComment.trim() || undefined })
            : JSON.stringify({});
      await apiFetch(`/api/v1/quotations/${params.id}/${path}`, { method: 'POST', body });
      await qc.invalidateQueries({ queryKey: ['quotation', params.id] });
      await qc.invalidateQueries({ queryKey: ['customer-orders'] });
    } catch {
      setError(tc('actionFailed'));
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const canDecide = dealerCanDecideQuotation(data.status);
  const so = data.salesOrders?.[0];

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/orders" />
      <PageHero
        tone="soft"
        title={data.number}
        meta={<StatusBadge status={data.status} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">
              {t('total')}: {String(data.total)} {tCommon('currency')}
            </p>
            <Button
              variant="secondary"
              onClick={() => window.open(`${API_URL}/api/v1/quotations/${data.id}/pdf`, '_blank')}
            >
              {t('downloadPdf')}
            </Button>
          </div>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {data.status === 'ACCEPTED' ? <Alert variant="success">{t('accepted')}</Alert> : null}
      {data.status === 'REJECTED' ? <Alert variant="error">{t('reject')}</Alert> : null}
      {data.status === 'REVISION_REQUESTED' ? (
        <Alert variant="info">{t('revisionRequested')}</Alert>
      ) : null}

      <MotionSection delayMs={40}>
        <Card title={tCommon('details')} className="maher-form-section">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {data.expirationDate ? (
              <div>
                <dt className="text-text-secondary">{t('validUntil')}</dt>
                <dd>{String(data.expirationDate).slice(0, 10)}</dd>
              </div>
            ) : null}
            {data.paymentTerms ? (
              <div>
                <dt className="text-text-secondary">{t('paymentTerms')}</dt>
                <dd>{data.paymentTerms}</dd>
              </div>
            ) : null}
            {data.deliveryTerms ? (
              <div>
                <dt className="text-text-secondary">{t('deliveryTerms')}</dt>
                <dd>{data.deliveryTerms}</dd>
              </div>
            ) : null}
            {data.customerNotes ? (
              <div className="sm:col-span-2">
                <dt className="text-text-secondary">{t('notes')}</dt>
                <dd>{data.customerNotes}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-text-secondary">{t('subtotal')}</dt>
              <dd>
                {String(data.subtotal ?? '—')} {tCommon('currency')}
              </dd>
            </div>
            {Number(data.discountTotal ?? 0) > 0 ? (
              <div>
                <dt className="text-text-secondary">{t('discount')}</dt>
                <dd>
                  {String(data.discountTotal)} {tCommon('currency')}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-text-secondary">{t('tax')}</dt>
              <dd>
                {String(data.taxAmount ?? data.taxTotal ?? '—')} {tCommon('currency')}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">{t('total')}</dt>
              <dd className="font-semibold">
                {String(data.total)} {tCommon('currency')}
              </dd>
            </div>
          </dl>
        </Card>
      </MotionSection>

      <MotionSection delayMs={60}>
        <Card title={t('lines')} padded={false} className="maher-form-section">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tc('description')}</TableHeaderCell>
                <TableHeaderCell>{t('specs')}</TableHeaderCell>
                <TableHeaderCell>{tc('qty')}</TableHeaderCell>
                <TableHeaderCell>{tc('price')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.lines ?? []).map((line) => {
                const spec = [line.material, line.fabric, line.color]
                  .filter(Boolean)
                  .join(' / ');
                const dims = [line.width, line.height, line.depth]
                  .filter((v) => v != null && v !== '')
                  .map(String)
                  .join('×');
                return (
                  <TableRow key={line.id}>
                    <TableCell>{line.description}</TableCell>
                    <TableCell>{[spec, dims].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell>{String(line.quantity)}</TableCell>
                    <TableCell>{String(line.unitPrice)}</TableCell>
                    <TableCell>{String(line.lineTotal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </MotionSection>

      {canDecide ? (
        <MotionSection delayMs={100}>
          <Card title={t('signToAccept')} className="maher-form-section">
            <canvas
              ref={canvasRef}
              width={560}
              height={160}
              className="w-full touch-none rounded-[var(--maher-radius-md)] border border-border bg-surface-muted"
              onMouseDown={() => {
                setDrawing(true);
                canvasRef.current?.getContext('2d')?.beginPath();
              }}
              onMouseUp={() => setDrawing(false)}
              onMouseLeave={() => setDrawing(false)}
              onMouseMove={draw}
              onTouchStart={() => {
                setDrawing(true);
                canvasRef.current?.getContext('2d')?.beginPath();
              }}
              onTouchEnd={() => setDrawing(false)}
              onTouchMove={draw}
            />
            <div className="maher-detail-sticky-actions mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={clearSignature}>
                {t('clearSignature')}
              </Button>
              <Button onClick={() => act('accept')} loading={loading}>
                {t('accept')}
              </Button>
              <Button variant="danger" onClick={() => act('reject')} loading={loading}>
                {t('reject')}
              </Button>
            </div>
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <label className="block text-sm text-text-secondary">{t('revisionComment')}</label>
              <textarea
                className="w-full rounded-[var(--maher-radius-md)] border border-border bg-surface px-3 py-2 text-sm"
                rows={2}
                value={revisionComment}
                onChange={(e) => setRevisionComment(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={() => act('request-revision')}
                loading={loading}
              >
                {t('requestRevision')}
              </Button>
            </div>
          </Card>
        </MotionSection>
      ) : null}

      {so ? (
        <MotionSection delayMs={140}>
          <Card title={tCommon('details')} className="maher-form-section">
            <Link href={`/orders/${so.id}`} className="font-medium text-brand hover:underline">
              {so.number} →
            </Link>
          </Card>
        </MotionSection>
      ) : null}
    </div>
  );
}
