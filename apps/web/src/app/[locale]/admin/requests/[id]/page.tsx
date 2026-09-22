'use client';

import { LineItemsEditor, emptyLineItem, type LineItemDraft } from '@/components/admin/line-items-editor';
import { DeliveryAvailabilityBoard, localDealerMinimumRequestYmd } from '@/components/orders/delivery-availability-board';
import { daysUntil, requestTone, useOrdersCopy } from '@/components/orders/orders-shared';
import { Link, useRouter } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { API_URL, apiFetch, apiUpload, apiUploadFromUrl } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { isHandwrittenDocument, latestJobNotes, lineHasAiFill, requestAiReadingFlags } from '@/lib/request-ai-reading';
import { localizedName } from '@maher/i18n';
import { manufacturingComplexityDisplayKey } from '@maher/types';
import {
  ActionDock,
  Attachments,
  Board,
  BoardSkeleton,
  Button,
  ConfirmDialog,
  DetailHero,
  ErrorBoard,
  FormFooter,
  InkPill,
  Input,
  KeyFacts,
  ListRow,
  ListRows,
  Ltr,
  Menu,
  PhotoAttachField,
  Stamp,
  TextArea,
  Ticket,
  anyToYmd,
  useToast,
  type BoardTone,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

interface RequestItem {
  id: string;
  productId?: string | null;
  productName: string;
  description?: string | null;
  quantity: number | string;
  unit?: string | null;
  material?: string | null;
  fabric?: string | null;
  color?: string | null;
  notes?: string | null;
  manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM' | string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  variantLabel?: string | null;
  woodType?: string | null;
  woodColor?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  accessories?: string | null;
  orientation?: string | null;
  fabrics?: Array<{ type?: string | null; color?: string | null; role?: string | null }> | null;
  provenance?: Array<{ key: string; ai: string | null; dealer: string | null; source: string }> | null;
  product?: { id: string; imageUrl?: string | null } | null;
}

interface RequestDetail {
  id: string;
  number: string;
  status: string;
  source?: string;
  projectName?: string | null;
  externalOrderNumber?: string | null;
  contactName?: string | null;
  deliveryAddress?: string | null;
  endCustomerName?: string | null;
  requiredDeliveryDate?: string | null;
  offeredDeliveryDate?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  priority?: string;
  presentationKey?: string;
  informationRequestReason?: string | null;
  createdAt?: string;
  submittedAt?: string | null;
  customer?: { id: string; name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null } | null;
  items: RequestItem[];
  documents?: Array<{ id: string; fileName: string; mimeType?: string | null; category?: string | null; downloadPath?: string | null }>;
  quotations?: Array<{ id: string; number: string; status: string }>;
  aiJobs?: Array<{ id: string; number: string; status: string; fields?: Array<{ fieldName: string; fieldValue?: string | null; reviewedValue?: string | null; confidence?: number | string | null }> }>;
  reviewHistory?: Array<{ at: string; action: string; message?: string | null }>;
}

export default function AdminRfqDetailPage({ params }: { params: { id: string } }) {
  const copy = useOrdersCopy();
  const kit = useKitCopy();
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tNav = useTranslations('navigation');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [projectName, setProjectName] = useState('');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [draftLines, setDraftLines] = useState<LineItemDraft[]>([]);
  const [needsInfoOpen, setNeedsInfoOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState('');
  const [dateReason, setDateReason] = useState('');
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const detail = useQuery({ queryKey: ['admin-rfq', params.id], queryFn: () => apiFetch<RequestDetail>(`/api/v1/requests/${params.id}`) });
  const data = detail.data;

  // Hydrate form drafts once per loaded record (not on every refetch).
  useEffect(() => {
    if (!data || hydratedFor === `${data.id}:${data.status}`) return;
    setInternalNotes(data.internalNotes ?? '');
    setProjectName(data.projectName ?? '');
    setExternalOrderNumber(data.externalOrderNumber ?? '');
    setPickedDate(anyToYmd(data.offeredDeliveryDate ?? data.requiredDeliveryDate));
    setDraftLines((data.items ?? []).map((item) => emptyLineItem({ key: item.id, description: item.productName, quantity: String(item.quantity), unitPrice: '0', notes: item.description ?? '' })));
    setHydratedFor(`${data.id}:${data.status}`);
  }, [data, hydratedFor]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['admin-rfq', params.id] });
    await qc.invalidateQueries({ queryKey: ['admin-rfqs'] });
    await qc.invalidateQueries({ queryKey: ['orders-desk'] });
    await qc.invalidateQueries({ queryKey: ['section-counts'] });
  };

  const submitMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/requests/${params.id}/submit`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success(tc('rfqSubmitted'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const workflowMutation = useMutation({
    mutationFn: (args: { path: string; body?: Record<string, unknown> }) => apiFetch(`/api/v1/requests/${params.id}/${args.path}`, { method: 'POST', body: args.body ? JSON.stringify(args.body) : undefined }),
    onSuccess: async () => {
      setError(null);
      setNeedsInfoOpen(false);
      setCloseOpen(false);
      toast.success(tc('rfqStatusUpdated'));
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const saveMutation = useMutation({
    mutationFn: () => {
      const isDraft = data?.status === 'DRAFT';
      const items = isDraft
        ? draftLines.filter((line) => line.description.trim()).map((line) => ({ productName: line.description.trim(), quantity: Number(line.quantity) || 0, notes: line.notes?.trim() || undefined }))
        : undefined;
      return apiFetch(`/api/v1/requests/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ internalNotes: internalNotes.trim() || undefined, projectName: projectName.trim() || undefined, externalOrderNumber: externalOrderNumber.trim() || undefined, ...(items ? { items } : {}) }),
      });
    },
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      setHydratedFor(null);
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const deliveryMutation = useMutation({
    mutationFn: (args: { kind: 'confirm' | 'change'; date: string; reason?: string }) =>
      args.kind === 'confirm'
        ? apiFetch(`/api/v1/requests/${params.id}/confirm-delivery`, { method: 'POST', body: JSON.stringify({ date: args.date }) })
        : apiFetch(`/api/v1/requests/${params.id}/change-delivery`, { method: 'POST', body: JSON.stringify({ date: args.date, reason: args.reason }) }),
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      setDateReason('');
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const quoteMutation = useMutation({
    mutationFn: async () => {
      if (!data?.customer?.id || !data.items.length) throw new Error(tc('customerItemsRequired'));
      return apiFetch<{ id: string }>('/api/v1/quotations', {
        method: 'POST',
        body: JSON.stringify({
          customerId: data.customer.id,
          requestId: data.id,
          offeredDeliveryDate: data.offeredDeliveryDate ?? undefined,
          customerNotes: data.notes ?? undefined,
          lines: data.items.map((item) => {
            const complexity = item.manufacturingComplexity === 'MODIFIED' || item.manufacturingComplexity === 'CUSTOM' ? item.manufacturingComplexity : item.manufacturingComplexity === 'STANDARD' ? 'STANDARD' : undefined;
            const width = Number(item.width);
            const height = Number(item.height);
            const depth = Number(item.depth);
            return {
              description: item.productName,
              quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
              unitPrice: 0,
              unit: 'pcs',
              ...(item.material ? { material: item.material } : {}),
              ...(item.fabric ? { fabric: item.fabric } : {}),
              ...(item.color ? { color: item.color } : {}),
              ...(complexity ? { manufacturingComplexity: complexity } : {}),
              ...(Number.isFinite(width) && width > 0 ? { width } : {}),
              ...(Number.isFinite(height) && height > 0 ? { height } : {}),
              ...(Number.isFinite(depth) && depth > 0 ? { depth } : {}),
              taxRate: 0.16,
            };
          }),
        }),
      });
    },
    onSuccess: (quote) => router.push(`/admin/quotations/${quote.id}`),
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const verifyMutation = useMutation({
    mutationFn: (body: { itemId?: string; action: 'CONFIRM' | 'CORRECT'; message?: string; fields?: Record<string, string> }) => apiFetch(`/api/v1/requests/${params.id}/verify-spec`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      toast.success(tc('confirmSpec'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const uploadMutation = useMutation({
    mutationFn: async (args: { file?: File; url?: string }) => {
      const qs = `category=RFQ_ATTACHMENT&requestId=${params.id}`;
      if (args.url) return apiUploadFromUrl(`/api/v1/uploads/from-url?${qs}`, { url: args.url });
      if (!args.file) throw new Error(tCommon('required'));
      const form = new FormData();
      form.append('file', args.file);
      return apiUpload(`/api/v1/uploads?${qs}`, form);
    },
    onSuccess: async () => {
      toast.success(tc('documentUploaded'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  async function openDocument(id: string) {
    try {
      const link = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${id}/link`);
      window.open(`${API_URL}${link.downloadPath}`, '_blank', 'noopener');
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }

  const availabilityItems = useMemo(
    () => (data?.items ?? []).filter((i) => i.productId).map((i) => ({ productId: i.productId as string, quantity: Math.max(1, Number(i.quantity) || 1) })),
    [data?.items],
  );

  if (detail.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} header={false} className="h-52" />
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <BoardSkeleton rows={4} />
          </div>
          <div className="space-y-5 xl:col-span-5">
            <BoardSkeleton rows={4} />
          </div>
        </div>
      </div>
    );
  }
  if (detail.isError || !data) return <ErrorBoard title={tNav('rfqRequests')} onRetry={() => detail.refetch()} />;

  const canUnderReview = ['SUBMITTED', 'NEEDS_INFORMATION'].includes(data.status);
  const canReady = ['UNDER_REVIEW', 'NEEDS_INFORMATION', 'SUBMITTED'].includes(data.status);
  const canNeedsInfo = ['SUBMITTED', 'UNDER_REVIEW'].includes(data.status);
  const canClose = !['CLOSED', 'CANCELLED', 'QUOTED'].includes(data.status);
  const canQuote = ['READY_FOR_QUOTATION', 'UNDER_REVIEW', 'SUBMITTED'].includes(data.status);
  const isOpen = !['CLOSED', 'CANCELLED', 'QUOTED'].includes(data.status);
  const minRequestYmd = localDealerMinimumRequestYmd();
  const requestedYmd = anyToYmd(data.requiredDeliveryDate);
  const offeredYmd = anyToYmd(data.offeredDeliveryDate);
  const confirmWouldOverrideLead = Boolean(requestedYmd && requestedYmd < minRequestYmd);
  const changeWouldOverrideLead = Boolean(pickedDate && pickedDate < minRequestYmd);
  const sheetDocs = (data.documents ?? []).filter(isHandwrittenDocument);
  const aiFlags = requestAiReadingFlags(data);
  const jobNotes = latestJobNotes(data);
  const tone: BoardTone = requestTone(data.status);
  const dealerName = data.customer ? localizedName(copy.locale, data.customer) : data.contactName ?? undefined;
  const waitingDays = data.status === 'SUBMITTED' || data.status === 'UNDER_REVIEW' ? Math.abs(daysUntil(data.submittedAt ?? data.createdAt) ?? 0) : null;
  const dirty = internalNotes !== (data.internalNotes ?? '') || projectName !== (data.projectName ?? '') || externalOrderNumber !== (data.externalOrderNumber ?? '') || (data.status === 'DRAFT' && draftLines.some((l, i) => l.description !== (data.items[i]?.productName ?? '') || String(l.quantity) !== String(data.items[i]?.quantity ?? '')));

  const presentation = () => {
    switch (data.presentationKey) {
      case 'waitingForReview':
        return tc('waitingForReview');
      case 'needsInformation':
        return tc('needsInformation');
      case 'draft':
        return tStatus('DRAFT');
      default:
        return copy.status(data.status);
    }
  };
  const sheetFieldLabel = (key: string) => ({ productName: tc('product'), quantity: tc('qty'), product: tc('product'), width: tc('width'), height: tc('height'), depth: tc('depth'), fabric: tc('fabric'), notes: tc('notes') })[key] ?? key;
  const flagReasonLabel = (reason: 'missing' | 'unclear' | 'mismatch') => (reason === 'missing' ? tc('rfqSheetUnclearMissing') : reason === 'unclear' ? tc('rfqSheetUnclearUnclear') : tc('rfqSheetUnclearMismatch'));
  const complexityLabel = (code?: string | null) => {
    if (!code) return null;
    const key = manufacturingComplexityDisplayKey(code);
    return key === 'standard' ? tc('lineKindStandard') : key === 'customized' ? tc('lineKindCustomized') : tc('lineKindCustom');
  };

  const attention: Array<{ id: string; tone: BoardTone; title: string; why: string; action?: string; onClick?: () => void }> = [];
  if (data.informationRequestReason) attention.push({ id: 'info', tone: 'warning', title: tc('informationRequestReason'), why: data.informationRequestReason });
  if (waitingDays != null && waitingDays >= 3) attention.push({ id: 'wait', tone: 'warning', title: tSales('desk.rfqWaitingWhy', { count: waitingDays }), why: tSales('desk.rfqWaitingHint'), action: canReady ? tc('markReadyForQuote') : undefined, onClick: canReady ? () => workflowMutation.mutate({ path: 'ready-for-quotation' }) : undefined });
  if (isOpen && (confirmWouldOverrideLead || changeWouldOverrideLead)) attention.push({ id: 'lead', tone: 'warning', title: tc('leadTimeOverrideWarning'), why: tSales('desk.leadTimeHint', { date: minRequestYmd }) });
  if (aiFlags.length) attention.push({ id: 'ai', tone: 'info', title: tc('rfqSheetUnclearTitle'), why: aiFlags.map((f) => `${sheetFieldLabel(f.key)} — ${flagReasonLabel(f.reason)}`).join(' · ') });

  const primary = data.status === 'DRAFT' ? (
    <InkPill onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
      {tCommon('submit')}
    </InkPill>
  ) : data.customer?.id && canQuote ? (
    <InkPill onClick={() => quoteMutation.mutate()} disabled={quoteMutation.isPending}>
      {tc('createQuotation')}
    </InkPill>
  ) : null;

  const menu = (
    <Menu
      LinkComponent={Link}
      aria-label={tSales('moreActions')}
      trigger={
        <Button variant="secondary" size="icon" aria-label={tSales('moreActions')}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      }
      items={[
        ...(canUnderReview ? [{ id: 'review', label: tc('markUnderReview'), onSelect: () => workflowMutation.mutate({ path: 'under-review' }) }] : []),
        ...(canReady ? [{ id: 'ready', label: tc('markReadyForQuote'), onSelect: () => workflowMutation.mutate({ path: 'ready-for-quotation' }) }] : []),
        ...(canNeedsInfo ? [{ id: 'needs', label: tc('needsInformation'), onSelect: () => setNeedsInfoOpen(true) }] : []),
        ...(data.customer ? [{ id: 'dealer', label: dealerName ?? tc('customer'), href: `/admin/customers/${data.customer.id}` }] : []),
        ...(canClose ? [{ id: 'close', label: tc('closeRfq'), tone: 'error' as const, separator: true, onSelect: () => setCloseOpen(true) }] : []),
      ]}
    />
  );

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        LinkComponent={Link}
        back={{ label: tNav('rfqRequests'), href: '/admin/requests' }}
        code={data.number}
        title={dealerName ?? data.number}
        subtitle={[data.projectName, data.endCustomerName ? `${tc('endCustomerName')}: ${data.endCustomerName}` : null].filter(Boolean).join(' · ') || tc('factoryReview')}
        status={{ label: presentation(), tone }}
        facts={[
          { label: tc('source'), value: copy.source(data.source) },
          { label: tc('priority'), value: data.priority ? copy.status(data.priority) : '—' },
          { label: tc('requestedDelivery'), value: requestedYmd || '—', ltr: true },
          { label: tc('offeredDelivery'), value: offeredYmd || '—', ltr: true, tone: offeredYmd ? 'success' : 'neutral' },
          { label: tc('lineItems'), value: String(data.items.length), ltr: true },
          { label: tc('submittedDate'), value: copy.date(data.submittedAt ?? data.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }), ltr: true },
        ]}
        primary={primary}
        actions={menu}
      />

      {attention.length ? (
        <Board tone="warning" wash="top">
          <Board.Header title={tSales('desk.needsAttention')} meta={<Stamp tone="warning" size="sm">{attention.length}</Stamp>} />
          <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
            {attention.map((a) => (
              <li key={a.id}>
                <Ticket tone={a.tone} title={a.title} why={a.why} action={a.action} onClick={a.onClick} />
              </li>
            ))}
          </ul>
        </Board>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-7">
          {/* Lines */}
          <Board tone="brand">
            <Board.Header title={tc('lineItems')} description={data.status === 'DRAFT' ? tSales('desk.draftLinesHint') : tSales('desk.reviewLinesHint')} meta={<span className="tabular-nums">{data.items.length}</span>} />
            {data.status === 'DRAFT' ? (
              <Board.Body>
                <LineItemsEditor lines={draftLines} onChange={setDraftLines} showUnitPrice={false} showNotes />
              </Board.Body>
            ) : data.items.length === 0 ? (
              <Board.Empty title={tc('noRfqs')} />
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
                {data.items.map((item) => {
                  const complexity = complexityLabel(item.manufacturingComplexity);
                  const specs = [
                    item.variantLabel,
                    [item.width, item.height, item.depth].filter((n) => n != null && n !== '').join(' × ') ? `${[item.width, item.height, item.depth].filter((n) => n != null && n !== '').join(' × ')} cm` : null,
                    item.orientation,
                    item.woodType,
                    item.foamDensity,
                    item.finish,
                    item.material,
                    item.fabric,
                    item.color,
                    ...(item.fabrics ?? []).map((row) => [row.type, row.color, row.role].filter(Boolean).join(' · ')),
                  ].filter(Boolean) as string[];
                  const provenance = (item.provenance ?? []).filter((row) => row.source !== 'missing');
                  return (
                    <li key={item.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <Stamp tone={item.manufacturingComplexity === 'CUSTOM' ? 'warning' : item.manufacturingComplexity === 'MODIFIED' ? 'info' : 'neutral'} className="mt-[7px]" />
                          <div className="min-w-0">
                            <Link href={`/admin/requests/${params.id}/lines/${item.id}`} className="text-[14px] font-semibold leading-5 text-[var(--maher-text-primary)] hover:text-[var(--maher-brand)] hover:underline">
                              {item.productName}
                            </Link>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] leading-4 text-[var(--maher-text-secondary)]">
                              {complexity ? <span className="text-[var(--maher-brand)]">{complexity}</span> : null}
                              {lineHasAiFill(item) ? (
                                <Stamp tone="info" size="sm">
                                  {tc('filledFromSheet')}
                                </Stamp>
                              ) : null}
                            </p>
                            {item.notes || item.description ? <p className="mt-1.5 text-[13px] leading-5 text-[var(--maher-text-secondary)]">{item.notes || item.description}</p> : null}
                            {specs.length ? (
                              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] leading-4 text-[var(--maher-text-tertiary)]">
                                {specs.map((s, i) => (
                                  <span key={i} dir="auto">
                                    {s}
                                  </span>
                                ))}
                              </p>
                            ) : null}
                            {provenance.length ? (
                              <ul className="mt-1.5 m-0 list-none p-0 text-[12px] leading-4 text-[var(--maher-text-tertiary)]">
                                {provenance.map((row) => (
                                  <li key={row.key}>
                                    {sheetFieldLabel(row.key)}: {tc('aiValue')} {row.ai ?? '—'} · {tc('dealerValue')} {row.dealer ?? '—'}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Ltr className="text-[14px] font-semibold text-[var(--maher-text-primary)]">× {String(item.quantity)}</Ltr>
                          {isOpen ? (
                            <span className="flex gap-1.5">
                              <Button size="sm" variant="secondary" loading={verifyMutation.isPending} onClick={() => verifyMutation.mutate({ itemId: item.id, action: 'CONFIRM' })}>
                                {tc('confirmSpec')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={verifyMutation.isPending}
                                onClick={() =>
                                  verifyMutation.mutate({
                                    itemId: item.id,
                                    action: 'CORRECT',
                                    message: [item.variantLabel, [item.width, item.height, item.depth].filter(Boolean).join('×')].filter(Boolean).join(' · '),
                                    fields: { width: String(item.width ?? ''), height: String(item.height ?? ''), depth: String(item.depth ?? '') },
                                  })
                                }
                              >
                                {tc('correctSpec')}
                              </Button>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Board>

          {/* Details form */}
          <Board tone="neutral">
            <Board.Header title={tCommon('details')} />
            <Board.Body className="space-y-4">
              <KeyFacts
                columns={2}
                facts={[
                  { label: tc('customer'), value: data.customer ? <Link href={`/admin/customers/${data.customer.id}`} className="text-[var(--maher-brand)] hover:underline">{dealerName}</Link> : data.contactName ?? '—' },
                  { label: tc('endCustomerName'), value: data.endCustomerName?.trim() || '—' },
                  { label: tc('deliveryAddress'), value: data.deliveryAddress?.trim() || '—', wide: true },
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={tSales('dealerOrderNumber')} value={externalOrderNumber} onChange={(e) => setExternalOrderNumber(e.target.value)} dir="ltr" disabled={!isOpen} />
                <Input label={tc('project')} value={projectName} onChange={(e) => setProjectName(e.target.value)} disabled={!isOpen} />
              </div>
              <TextArea label={tc('internalNotes')} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={3} disabled={!isOpen} />
              {data.notes ? (
                <div>
                  <p className="text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{tSales('customerNotes')}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-6 text-[var(--maher-text-primary)]">{data.notes}</p>
                </div>
              ) : null}
            </Board.Body>
            {isOpen ? (
              <Board.Footer>
                <span className="flex items-center gap-2">{dirty ? <Stamp tone="warning" /> : null}{dirty ? kit.unsaved : ''}</span>
                <Button size="sm" variant={dirty ? 'primary' : 'secondary'} onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!dirty}>
                  {tCommon('save')}
                </Button>
              </Board.Footer>
            ) : null}
          </Board>

          {/* Handwritten sheet record */}
          {sheetDocs.length ? (
            <Board tone="info">
              <Board.Header title={tc('rfqSheetRecord')} description={tc('rfqSheetHint')} />
              <Board.Body>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sheetDocs.map((d) => (
                    <button key={d.id} type="button" onClick={() => void openDocument(d.id)} className="maher-press flex flex-col gap-2 rounded-[14px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] p-2 text-start">
                      {(d.mimeType ?? '').startsWith('image/') && d.downloadPath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${API_URL}${d.downloadPath}`} alt={d.fileName} className="max-h-64 w-full rounded-[10px] object-contain" />
                      ) : null}
                      <span className="truncate px-1 text-[13px] font-medium text-[var(--maher-text-primary)]">{d.fileName}</span>
                    </button>
                  ))}
                </div>
                {jobNotes ? <p className="mt-3 text-[13px] leading-5 text-[var(--maher-text-secondary)]">{jobNotes}</p> : null}
              </Board.Body>
            </Board>
          ) : null}

          {/* Attachments */}
          <Board tone="neutral" className="xl:flex-1">
            <Board.Header title={tc('attachments')} meta={<span className="tabular-nums">{data.documents?.length ?? 0}</span>} />
            <Board.Body className="space-y-4" grow>
              <Attachments
                copy={kit.attachments}
                items={[...(data.documents ?? [])]
                  .sort((a, b) => (isHandwrittenDocument(a) ? 0 : 1) - (isHandwrittenDocument(b) ? 0 : 1))
                  .map((d) => ({ id: d.id, name: d.fileName, mime: d.mimeType ?? null, thumbUrl: (d.mimeType ?? '').startsWith('image/') && d.downloadPath ? `${API_URL}${d.downloadPath}` : null }))}
                onOpen={(item) => void openDocument(item.id)}
              />
              {isOpen ? (
                <PhotoAttachField
                  hint={tCommon('photoUrlHint')}
                  accept="application/pdf,image/*,.doc,.docx,.xlsx"
                  uploadLabel={tCommon('upload')}
                  uploadingLabel={tCommon('uploading')}
                  attachUrlLabel={tCommon('attachFromUrl')}
                  disabled={uploadMutation.isPending}
                  onUploadFile={async (file) => {
                    await uploadMutation.mutateAsync({ file });
                  }}
                  onAttachUrl={async (url) => {
                    await uploadMutation.mutateAsync({ url });
                  }}
                />
              ) : null}
            </Board.Body>
          </Board>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          {/* Delivery availability */}
          <DeliveryAvailabilityBoard
            title={tc('requestedDelivery')}
            description={tSales('desk.availabilityHint')}
            items={availabilityItems}
            requestedDate={data.requiredDeliveryDate}
            offeredDate={data.offeredDeliveryDate}
            selected={pickedDate}
            onSelect={setPickedDate}
            customerId={data.customer?.id}
            enabled={isOpen}
            footer={
              isOpen ? (
                <div className="flex w-full flex-col gap-3">
                  <Input label={tc('changeDateReason')} value={dateReason} onChange={(e) => setDateReason(e.target.value)} placeholder={tSales('desk.changeDateReasonHint')} />
                  <div className="flex flex-wrap justify-end gap-2">
                    {requestedYmd && !confirmWouldOverrideLead && requestedYmd !== offeredYmd ? (
                      <Button size="sm" variant="secondary" loading={deliveryMutation.isPending} onClick={() => deliveryMutation.mutate({ kind: 'confirm', date: requestedYmd })}>
                        {tc('confirmDate')}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      loading={deliveryMutation.isPending}
                      disabled={!pickedDate || pickedDate === offeredYmd || !dateReason.trim()}
                      onClick={() => deliveryMutation.mutate({ kind: 'change', date: pickedDate, reason: dateReason.trim() })}
                    >
                      {tc('changeDate')} {pickedDate ? <Ltr className="ms-1 opacity-80">{pickedDate}</Ltr> : null}
                    </Button>
                  </div>
                </div>
              ) : null
            }
          />

          {/* Quotations */}
          <Board tone={(data.quotations?.length ?? 0) ? 'success' : 'neutral'} className="xl:flex-1">
            <Board.Header title={tc('quotations')} meta={<span className="tabular-nums">{data.quotations?.length ?? 0}</span>} />
            <Board.Body padding="none" grow>
              {(data.quotations?.length ?? 0) > 0 ? (
                <ListRows>
                  {data.quotations!.map((q) => (
                    <ListRow key={q.id} href={`/admin/quotations/${q.id}`} LinkComponent={Link} tone="success" title={<Ltr>{q.number}</Ltr>} meta={copy.status(q.status)} />
                  ))}
                </ListRows>
              ) : (
                <Board.Empty
                  title={tSales('desk.noQuotationYet')}
                  description={tSales('desk.noQuotationYetBody')}
                  action={
                    data.customer?.id && canQuote ? (
                      <Button size="sm" onClick={() => quoteMutation.mutate()} loading={quoteMutation.isPending}>
                        {tc('createQuotation')}
                      </Button>
                    ) : null
                  }
                />
              )}
            </Board.Body>
          </Board>
        </div>
      </div>

      <ActionDock className="md:hidden" note={<Ltr>{data.number}</Ltr>}>
        {menu}
        {primary}
      </ActionDock>

      {dirty && data.status === 'DRAFT' ? (
        <FormFooter
          dirty
          dirtyLabel={kit.unsaved}
          primary={
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              {tCommon('save')}
            </Button>
          }
        />
      ) : null}

      <ConfirmDialog
        open={needsInfoOpen}
        title={tc('needsInformation')}
        description={tc('informationRequestReasonHint')}
        confirmLabel={tc('needsInformation')}
        cancelLabel={tCommon('cancel')}
        withReason
        reasonRequired
        reasonLabel={tc('informationRequestReason')}
        loading={workflowMutation.isPending}
        error={error}
        onConfirm={(reason) => {
          if (!reason?.trim()) {
            setError(tc('informationRequestReasonRequired'));
            return;
          }
          setError(null);
          workflowMutation.mutate({ path: 'needs-information', body: { reason: reason.trim() } });
        }}
        onClose={() => setNeedsInfoOpen(false)}
      />
      <ConfirmDialog
        open={closeOpen}
        title={tc('closeRfq')}
        description={tc('closeRfqConfirm')}
        confirmLabel={tc('closeRfq')}
        cancelLabel={tCommon('cancel')}
        danger
        loading={workflowMutation.isPending}
        error={error}
        onConfirm={() => workflowMutation.mutate({ path: 'close' })}
        onClose={() => setCloseOpen(false)}
      />
    </div>
  );
}
