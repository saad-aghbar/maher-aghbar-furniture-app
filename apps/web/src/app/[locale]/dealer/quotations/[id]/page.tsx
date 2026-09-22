'use client';

import { useDealerMoney } from '@/components/dealer/catalog-shared';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { ActionDock, Alert, Board, BoardSkeleton, Button, ConfirmDialog, DataBoard, DetailHero, Figure, KeyFacts, Ledger, LedgerRow, Ltr, Stamp, TextArea, type BoardTone, type DataColumn } from '@maher/ui';
import { FileText, PenLine } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { presentQuotationStatus } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';
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
  commerciallyExpired?: boolean;
  rejectionReason?: string | null;
  acceptanceSignature?: string | null;
  lines: QuoteLine[];
  salesOrders?: Array<{ id: string; number: string; status: string }>;
}

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const t = useTranslations('quotations');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const router = useRouter();
  const money = useDealerMoney();
  const { openPdf, pdfDialog } = usePdfDownload();
  const [confirm, setConfirm] = useState<'accept' | 'reject' | 'request-revision' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
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
            : JSON.stringify({ comment: rejectComment.trim() || undefined });
      await apiFetch(`/api/v1/quotations/${params.id}/${path}`, { method: 'POST', body });
      await qc.invalidateQueries({ queryKey: ['quotation', params.id] });
      await qc.invalidateQueries({ queryKey: ['customer-orders'] });
      await qc.invalidateQueries({ queryKey: ['customer-quotations-list'] });
      setConfirm(null);
    } catch {
      setError(tc('actionFailed'));
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={5} />
      </div>
    );
  }

  const canDecide = dealerCanDecideQuotation(data.status, data.commerciallyExpired);
  const statusLabel = presentQuotationStatus(locale, data.status, data.commerciallyExpired);
  const so = data.salesOrders?.[0];

  const tone: BoardTone = data.commerciallyExpired ? 'neutral' : data.status === 'ACCEPTED' ? 'success' : data.status === 'REJECTED' ? 'error' : canDecide ? 'warning' : 'info';
  const currency = data.currency ?? 'ILS';
  const fmt = (v: string | number | null | undefined) => (v == null || v === '' ? '—' : money(Number(v), currency));
  const columns: DataColumn<QuoteLine>[] = [
    { key: 'description', header: tc('description'), cell: (line) => <span className="font-medium text-[var(--maher-text-primary)]">{line.description}</span> },
    {
      key: 'specs',
      header: t('specs'),
      hideBelow: 'md',
      cell: (line) => {
        const spec = [line.material, line.fabric, line.color].filter(Boolean).join(' / ');
        const dims = [line.width, line.height, line.depth].filter((v) => v != null && v !== '').map(String).join('×');
        return <span className="text-[var(--maher-text-secondary)]">{[spec, dims].filter(Boolean).join(' · ') || '—'}</span>;
      },
    },
    { key: 'qty', header: tc('qty'), numeric: true, width: '72px', cell: (line) => <Ltr>{String(line.quantity)}</Ltr> },
    { key: 'unit', header: tc('price'), numeric: true, hideBelow: 'lg', cell: (line) => <Ltr>{fmt(line.unitPrice)}</Ltr> },
    { key: 'total', header: tCommon('total'), numeric: true, cell: (line) => <Ltr className="font-semibold">{fmt(Number(line.unitPrice) * Number(line.quantity) || 0)}</Ltr> },
  ];
  const confirmCopy = confirm === 'accept'
    ? { title: t('accept'), description: t('signToAccept'), label: t('accept'), danger: false }
    : confirm === 'reject'
      ? { title: t('reject'), description: rejectComment.trim() || t('rejectReasonOptional'), label: t('reject'), danger: true }
      : { title: t('requestRevision'), description: revisionComment.trim() || t('revisionComment'), label: t('requestRevision'), danger: false };

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        tone={tone}
        back={{ label: t('title'), onClick: () => router.push('/dealer/quotations') }}
        code={data.number}
        title={`${t('title')} · v${data.version ?? 1}`}
        subtitle={data.expirationDate ? `${t('validUntil')}: ${String(data.expirationDate).slice(0, 10)}` : undefined}
        status={{ label: statusLabel, tone }}
        facts={[
          { label: t('total'), value: fmt(data.total), ltr: true, tone },
          { label: t('lines'), value: `${data.lines?.length ?? 0}`, ltr: true },
          ...(data.paymentTerms ? [{ label: t('paymentTerms'), value: data.paymentTerms }] : []),
          ...(data.deliveryTerms ? [{ label: t('deliveryTerms'), value: data.deliveryTerms }] : []),
        ]}
        primary={canDecide ? <Button leadingIcon={<PenLine className="h-4 w-4" />} onClick={() => setConfirm('accept')}>{t('accept')}</Button> : undefined}
        actions={
          <Button variant="secondary" leadingIcon={<FileText className="h-4 w-4" />} onClick={() => openPdf({ path: `/api/v1/quotations/${data.id}/pdf`, documentName: data.number, filename: `${data.number}.pdf` })}>
            {t('downloadPdf')}
          </Button>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {data.status === 'ACCEPTED' ? <Alert variant="success">{t('accepted')}</Alert> : null}
      {data.status === 'REJECTED' ? <Alert variant="error">{`${t('reject')}${data.rejectionReason ? ` — ${data.rejectionReason}` : ''}`}</Alert> : null}
      {data.commerciallyExpired ? <Alert variant="warning">{t('expiredCannotAccept')}</Alert> : null}
      {(data.version ?? 1) > 1 ? <Alert variant="info">{t('revised')}</Alert> : null}
      {data.status === 'REVISION_REQUESTED' ? <Alert variant="info">{t('revisionRequested')}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <DataBoard<QuoteLine> aria-label={t('lines')} title={t('lines')} meta={<Stamp tone="neutral" size="sm">{data.lines?.length ?? 0}</Stamp>} columns={columns} rows={data.lines ?? []} rowKey={(l) => l.id} mobileRow={(l) => ({ title: l.description, meta: `× ${String(l.quantity)}`, trailing: <Ltr className="font-semibold">{fmt(Number(l.unitPrice) * Number(l.quantity) || 0)}</Ltr> })} empty={<Board.Empty title={tCommon('none')} />} />

          {canDecide ? (
            <Board tone="warning" wash="top">
              <Board.Header title={t('signToAccept')} description={t('rejectReasonOptional')} />
              <Board.Body className="space-y-4">
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={160}
                  className="w-full touch-none rounded-[12px] border border-dashed border-[var(--maher-border-strong,var(--maher-border))] bg-[var(--maher-surface-muted)]"
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={clearSignature}>
                    {t('clearSignature')}
                  </Button>
                  <Button onClick={() => setConfirm('accept')} loading={loading && confirm === 'accept'}>
                    {t('accept')}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <TextArea label={t('rejectReasonOptional')} rows={2} value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} placeholder={t('rejectReasonPlaceholder')} />
                    <Button variant="danger" size="sm" onClick={() => setConfirm('reject')} loading={loading && confirm === 'reject'}>
                      {t('reject')}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <TextArea label={t('revisionComment')} rows={2} value={revisionComment} onChange={(e) => setRevisionComment(e.target.value)} />
                    <Button variant="secondary" size="sm" onClick={() => setConfirm('request-revision')} loading={loading && confirm === 'request-revision'}>
                      {t('requestRevision')}
                    </Button>
                  </div>
                </div>
              </Board.Body>
            </Board>
          ) : null}
        </div>

        <div className="space-y-5 xl:col-span-4">
          <Board tone={tone} className="xl:sticky xl:top-28">
            <Board.Header title={t('total')} />
            <Board.Body className="space-y-4">
              <Figure size="lg" value={fmt(data.total)} label={t('total')} tone={tone} locale={locale} />
              <Ledger>
                <LedgerRow label={t('subtotal')} value={<Ltr>{fmt(data.subtotal)}</Ltr>} />
                {Number(data.discountTotal ?? 0) > 0 ? <LedgerRow label={t('discount')} value={<Ltr>−{fmt(data.discountTotal)}</Ltr>} tone="success" stamp /> : null}
                <LedgerRow label={t('tax')} value={<Ltr>{fmt(data.taxAmount ?? data.taxTotal)}</Ltr>} />
                <LedgerRow label={t('total')} value={<Ltr className="font-semibold">{fmt(data.total)}</Ltr>} tone={tone} stamp />
              </Ledger>
              {so ? (
                <Ledger>
                  <LedgerRow label={tCommon('details')} value={<Ltr>{so.number}</Ltr>} tone="brand" stamp href={`/dealer/orders/${so.id}`} LinkComponent={Link} />
                </Ledger>
              ) : null}
            </Board.Body>
          </Board>
          {data.customerNotes || data.paymentTerms || data.deliveryTerms ? (
            <Board tone="neutral">
              <Board.Header title={tCommon('details')} />
              <KeyFacts
                className="px-5 pb-5"
                columns={2}
                facts={[
                  ...(data.paymentTerms ? [{ label: t('paymentTerms'), value: data.paymentTerms }] : []),
                  ...(data.deliveryTerms ? [{ label: t('deliveryTerms'), value: data.deliveryTerms }] : []),
                  ...(data.customerNotes ? [{ label: t('notes'), value: data.customerNotes, wide: true }] : []),
                ]}
              />
            </Board>
          ) : null}
        </div>
      </div>

      {canDecide ? (
        <ActionDock className="md:hidden" note={<Ltr className="font-semibold">{fmt(data.total)}</Ltr>}>
          <Button variant="secondary" onClick={() => setConfirm('reject')}>{t('reject')}</Button>
          <Button className="flex-1" onClick={() => setConfirm('accept')}>{t('accept')}</Button>
        </ActionDock>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.label}
        cancelLabel={tCommon('cancel')}
        danger={confirmCopy.danger}
        loading={loading}
        error={error}
        onClose={() => !loading && setConfirm(null)}
        onConfirm={() => confirm && void act(confirm)}
      />
      {pdfDialog}
    </div>
  );
}
