'use client';

import { DealerOrderDetails } from '@/components/dealer-order-details';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { Alert, Attachments, Board, BoardSkeleton, Button, DateField, DetailHero, ErrorBoard, FormFooter, Input, ListRow, ListRows, Ltr, RowThumb, Sheet, StageStrip, Stamp, TextArea, useToast, type BoardTone, type StageStripStage } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface RequestItem {
  id: string;
  productName: string;
  description?: string | null;
  quantity: string | number;
  fabricType?: string | null;
  fabricColor?: string | null;
  fabric?: string | null;
  color?: string | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  notes?: string | null;
  manufacturingComplexity?: string | null;
  variantLabel?: string | null;
  customMeasurements?: Array<{ label: string; value: string }> | null;
  photos?: Array<{ id: string; fileName: string; mimeType: string; url: string | null }> | null;
  product?: { id: string; imageUrl?: string | null } | null;
}

interface RequestDoc {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category?: string | null;
  downloadPath?: string | null;
}

interface RequestDetail {
  id: string;
  number: string;
  status: string;
  createdAt?: string;
  submittedAt?: string | null;
  externalOrderNumber?: string | null;
  projectName?: string | null;
  endCustomerName?: string | null;
  endCustomerPhone?: string | null;
  endCustomerFax?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  requiredDeliveryDate?: string | null;
  offeredDeliveryDate?: string | null;
  notes?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  informationRequestReason?: string | null;
  items?: RequestItem[];
  documents?: RequestDoc[];
  quotations?: Array<{ id: string; number: string; status: string }>;
  editPolicy?: { canEdit: boolean; remainingMs: number; editWindowEndsAt: string | null; lockedFields?: string[] } | null;
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function fmtRemaining(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}

/**
 * Dealer request detail — what the dealer sent, where the factory is with it,
 * and (inside the edit window or after a need-info question) a small editor
 * to update the order and send it back. Mirrors the mobile customer request screen.
 */
export default function CustomerRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const tc = useTranslations('catalog');
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const tNav = useTranslations('navigation');
  const locale = useLocale();
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState({ externalOrderNumber: '', notes: '', requiredDeliveryDate: '', deliveryAddress: '' });

  const query = useQuery({ queryKey: ['dealer-request', id], queryFn: () => apiFetch<RequestDetail>(`/api/v1/requests/${id}`) });
  const req = query.data;
  useEffect(() => {
    if (!req || !editOpen) return;
    setDraft({ externalOrderNumber: req.externalOrderNumber ?? '', notes: req.notes ?? '', requiredDeliveryDate: req.requiredDeliveryDate?.slice(0, 10) ?? '', deliveryAddress: req.deliveryAddress ?? '' });
  }, [req, editOpen]);

  const needsInfo = /NEEDS_INFO/.test((req?.status ?? '').toUpperCase());
  const save = useMutation({
    mutationFn: async (resubmit: boolean) => {
      await apiFetch(`/api/v1/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          externalOrderNumber: draft.externalOrderNumber.trim() || undefined,
          notes: draft.notes.trim() || undefined,
          requiredDeliveryDate: draft.requiredDeliveryDate || undefined,
          deliveryAddress: draft.deliveryAddress.trim() || undefined,
        }),
      });
      if (resubmit) await apiFetch(`/api/v1/requests/${id}/submit`, { method: 'POST' });
    },
    onSuccess: async (_r, resubmit) => {
      toast.success(resubmit ? tc('requestResubmitted') : tc('requestUpdated'));
      setEditOpen(false);
      await Promise.all([qc.invalidateQueries({ queryKey: ['dealer-request', id] }), qc.invalidateQueries({ queryKey: ['dealer-requests'] })]);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={4} />
        <BoardSkeleton rows={4} />
      </div>
    );
  }
  if (query.isError || !req) {
    return <ErrorBoard title={tNav('rfqRequests')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }

  const items = req.items ?? [];
  const first = items[0];
  const statusKey = req.status.toUpperCase();
  const tone: BoardTone = /NEED/.test(statusKey) ? 'error' : /(QUOTED|READY)/.test(statusKey) ? 'success' : /(CLOSED|CANCEL|REJECT)/.test(statusKey) ? 'neutral' : 'info';
  const statusLabel = tStatus.has(req.status as never) ? tStatus(req.status as never) : req.status.replace(/_/g, ' ').toLowerCase();
  const hero = mediaSrc(req.imageUrl) ?? mediaSrc(first?.photos?.[0]?.url) ?? first?.product?.imageUrl ?? null;
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDate = (v?: string | null) => (v ? dateFmt.format(new Date(v)) : '—');
  const canEdit = Boolean(req.editPolicy?.canEdit) || needsInfo;
  const quoted = (req.quotations?.length ?? 0) > 0 || /QUOTED|CLOSED/.test(statusKey);
  const journey: StageStripStage[] = [
    { key: 'submitted', label: tc('journeySubmitted'), state: 'done' },
    { key: 'review', label: tc('journeyReview'), state: needsInfo ? 'blocked' : /UNDER_REVIEW|READY_FOR_QUOTATION|SUBMITTED/.test(statusKey) && !quoted ? 'current' : quoted ? 'done' : 'todo' },
    { key: 'quoted', label: tc('journeyQuoted'), state: quoted ? (statusKey === 'CLOSED' ? 'done' : 'current') : 'todo' },
    { key: 'order', label: tc('journeyOrder'), state: statusKey === 'CLOSED' ? 'done' : 'todo' },
  ];
  const docs = (req.documents ?? []).map((d) => ({ id: d.id, name: d.fileName, mime: d.mimeType ?? null, thumbUrl: (d.mimeType ?? '').startsWith('image/') && d.downloadPath ? `${API_URL}${d.downloadPath}` : null }));

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        back={{ label: tNav('rfqRequests'), href: '/dealer/requests' }}
        LinkComponent={Link}
        code={<Ltr>{req.number}</Ltr>}
        title={req.title ?? req.projectName ?? first?.productName ?? req.number}
        subtitle={req.externalOrderNumber ? `${t('dealerOrderNumber')}: ${req.externalOrderNumber}` : undefined}
        status={{ label: statusLabel, tone }}
        tone={tone}
        media={<RowThumb src={hero} className="h-[88px] w-[88px]" />}
        facts={[
          { label: tc('lineItems'), value: String(items.length), ltr: true },
          { label: tc('requestedDelivery'), value: fmtDate(req.requiredDeliveryDate), ltr: true },
          ...(req.offeredDeliveryDate ? [{ label: t('desk.deliveryDate'), value: fmtDate(req.offeredDeliveryDate), ltr: true, tone: 'success' as BoardTone }] : []),
          { label: tc('journeySubmitted'), value: fmtDate(req.submittedAt ?? req.createdAt), ltr: true },
        ]}
        primary={
          canEdit ? (
            <Button leadingIcon={needsInfo ? <Send className="h-4 w-4 rtl:-scale-x-100" /> : <Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
              {needsInfo ? tc('resubmit') : tc('editRequest')}
            </Button>
          ) : undefined
        }
      >
        <StageStrip stages={journey} />
      </DetailHero>

      {needsInfo && req.informationRequestReason ? (
        <Alert variant="warning">
          <p className="font-medium">{tc('informationRequestReason')}</p>
          <p className="mt-1 text-sm">{req.informationRequestReason}</p>
        </Alert>
      ) : null}
      {!needsInfo && req.editPolicy?.canEdit && req.editPolicy.remainingMs > 0 ? <Alert variant="info">{tc('editWindowLeft', { time: fmtRemaining(req.editPolicy.remainingMs) })}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          <Board tone="brand">
            <Board.Header title={tc('lineItems')} meta={<span className="tabular-nums">{items.length}</span>} />
            <ListRows>
              {items.map((item) => {
                const dims = [item.width, item.height, item.depth].filter((v) => v != null && v !== '').join(' × ');
                const complexity = item.manufacturingComplexity === 'CUSTOM' ? tc('lineKindCustom') : item.manufacturingComplexity === 'MODIFIED' ? tc('lineKindCustomized') : tc('lineKindStandard');
                const fabric = [item.fabricType ?? item.fabric, item.fabricColor ?? item.color].filter(Boolean).join(' · ');
                return (
                  <ListRow
                    key={item.id}
                    chevron={false}
                    leading={<RowThumb src={mediaSrc(item.photos?.[0]?.url) ?? item.product?.imageUrl} className="h-12 w-12" icon={<Stamp tone={item.manufacturingComplexity === 'CUSTOM' ? 'warning' : item.manufacturingComplexity === 'MODIFIED' ? 'info' : 'neutral'} />} />}
                    title={item.productName}
                    meta={
                      <span className="block">
                        <span className="block">{[complexity, item.variantLabel, dims ? `${dims} cm` : null, fabric || null].filter(Boolean).join(' · ')}</span>
                        {item.notes || item.description ? <span className="block text-[var(--maher-text-tertiary)]">{item.notes || item.description}</span> : null}
                      </span>
                    }
                    trailing={<Ltr className="text-[14px] font-semibold">× {String(item.quantity)}</Ltr>}
                  />
                );
              })}
            </ListRows>
          </Board>

          <DealerOrderDetails
            externalOrderNumber={req.externalOrderNumber}
            notes={req.notes}
            endCustomerName={req.endCustomerName}
            endCustomerPhone={req.endCustomerPhone}
            endCustomerFax={req.endCustomerFax}
            deliveryAddress={req.deliveryAddress}
            deliveryLat={req.deliveryLat}
            deliveryLng={req.deliveryLng}
            items={items}
          />
        </div>

        <div className="space-y-5 xl:col-span-5">
          <Board tone={(req.quotations?.length ?? 0) ? 'success' : 'neutral'}>
            <Board.Header title={tc('quotations')} meta={<span className="tabular-nums">{req.quotations?.length ?? 0}</span>} />
            {(req.quotations?.length ?? 0) > 0 ? (
              <ListRows>
                {req.quotations!.map((q) => (
                  <ListRow key={q.id} href={`/dealer/quotations/${q.id}`} LinkComponent={Link} tone="success" title={<Ltr>{q.number}</Ltr>} meta={tStatus.has(q.status as never) ? tStatus(q.status as never) : q.status} />
                ))}
              </ListRows>
            ) : (
              <Board.Empty title={tc('dealerNoQuoteYet')} description={tc('dealerNoQuoteYetBody')} />
            )}
          </Board>

          {docs.length > 0 ? (
            <Board tone="neutral">
              <Board.Header title={tc('attachmentsSection')} meta={<span className="tabular-nums">{docs.length}</span>} />
              <Board.Body>
                <Attachments
                  copy={kit.attachments}
                  items={docs}
                  onOpen={async (item) => {
                    try {
                      const res = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${item.id}/link`);
                      window.open(`${API_URL}${res.downloadPath}`, '_blank', 'noopener,noreferrer');
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              </Board.Body>
            </Board>
          ) : null}
        </div>
      </div>

      <Sheet open={editOpen} onClose={() => !save.isPending && setEditOpen(false)} title={needsInfo ? tc('resubmit') : tc('editRequest')} description={needsInfo ? tc('resubmitHint') : tc('editRequestHint')} closeLabel={tCommon('close')}>
        <div className="space-y-4">
          <Input label={t('dealerOrderNumber')} value={draft.externalOrderNumber} onChange={(e) => setDraft({ ...draft, externalOrderNumber: e.target.value })} dir="ltr" />
          <DateField label={tc('requestedDelivery')} value={draft.requiredDeliveryDate} onChange={(v) => setDraft({ ...draft, requiredDeliveryDate: v })} copy={kit.date} locale={locale} variant="dealer" />
          <TextArea autoGrow rows={2} label={tc('deliveryAddress')} value={draft.deliveryAddress} onChange={(e) => setDraft({ ...draft, deliveryAddress: e.target.value })} />
          <TextArea autoGrow rows={4} label={tc('yourNotes')} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder={needsInfo ? req.informationRequestReason ?? undefined : undefined} />
          <FormFooter
            secondary={
              <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={save.isPending}>
                {tCommon('cancel')}
              </Button>
            }
            primary={
              <Button loading={save.isPending} onClick={() => save.mutate(needsInfo)}>
                {needsInfo ? tc('resubmit') : tCommon('save')}
              </Button>
            }
          />
        </div>
      </Sheet>
    </div>
  );
}
