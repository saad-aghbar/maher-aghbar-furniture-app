'use client';

import { daysUntil, quotationTone, useOrdersCopy } from '@/components/orders/orders-shared';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuthMe } from '@/hooks/use-auth-me';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { localizedName, presentQuotationStatus } from '@maher/i18n';
import { can } from '@maher/permissions';
import {
  ActionDock,
  Board,
  BoardSkeleton,
  Button,
  ConfirmDialog,
  DataBoard,
  DateField,
  DetailHero,
  DocumentActions,
  ErrorBoard,
  Figure,
  FormFooter,
  InkPill,
  KeyFacts,
  Ledger,
  LedgerRow,
  Ltr,
  Menu,
  MoneyField,
  StageStrip,
  Stamp,
  Ticket,
  anyToYmd,
  useToast,
  type BoardTone,
  type DataColumn,
  type StageStripStage,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

interface QuoteLine {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
  material?: string | null;
  fabric?: string | null;
  color?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  discountValue?: number | string | null;
  taxRate?: number | string | null;
  manufacturingComplexity?: string | null;
  priceRequired?: boolean;
}

interface QuotationDetail {
  id: string;
  number: string;
  total: number | string;
  subtotal?: number | string;
  taxTotal?: number | string;
  currency?: string | null;
  status: string;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  offeredDeliveryDate?: string | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
  createdAt?: string;
  sentAt?: string | null;
  customer?: { id?: string; name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null };
  pendingApproverRole?: string | null;
  approvalChain?: string[];
  completedApprovalSteps?: string[];
  lines?: QuoteLine[];
  request?: { id: string; number: string; externalOrderNumber?: string | null } | null;
  salesOrder?: { id: string; number: string } | null;
  expirationDate?: string | null;
  commerciallyExpired?: boolean;
  rejectionReason?: string | null;
  version?: number;
}

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const copy = useOrdersCopy();
  const kit = useKitCopy();
  const t = useTranslations('quotations');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const toast = useToast();
  const me = useAuthMe();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { openPdf, pdfDialog } = usePdfDownload();

  const [expirationDate, setExpirationDate] = useState('');
  const [offeredDeliveryDate, setOfferedDeliveryDate] = useState('');
  const [draftPrices, setDraftPrices] = useState<Record<string, number | null>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const detail = useQuery({ queryKey: ['quotation', params.id], queryFn: () => apiFetch<QuotationDetail>(`/api/v1/quotations/${params.id}`) });
  const data = detail.data;

  useEffect(() => {
    if (!data || hydratedFor === `${data.id}:${data.status}`) return;
    setExpirationDate(anyToYmd(data.expirationDate));
    setOfferedDeliveryDate(anyToYmd(data.offeredDeliveryDate));
    setDraftPrices(Object.fromEntries((data.lines ?? []).map((l) => [l.id, Number(l.unitPrice) > 0 ? Number(l.unitPrice) : null])));
    setHydratedFor(`${data.id}:${data.status}`);
  }, [data, hydratedFor]);

  const draftPayload = () => ({
    expirationDate: expirationDate || undefined,
    offeredDeliveryDate: offeredDeliveryDate || undefined,
    lines: (data?.lines ?? []).map((line) => ({
      id: line.id,
      description: line.description,
      quantity: Number(line.quantity) || 1,
      unitPrice: Number(draftPrices[line.id] ?? line.unitPrice) || 0,
      material: line.material ?? undefined,
      fabric: line.fabric ?? undefined,
      color: line.color ?? undefined,
      width: line.width != null ? Number(line.width) : undefined,
      height: line.height != null ? Number(line.height) : undefined,
      depth: line.depth != null ? Number(line.depth) : undefined,
      taxRate: line.taxRate != null ? Number(line.taxRate) : undefined,
      manufacturingComplexity: line.manufacturingComplexity ?? undefined,
    })),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['quotation', params.id] });
    await queryClient.invalidateQueries({ queryKey: ['quotations'] });
    await queryClient.invalidateQueries({ queryKey: ['quotations-counts'] });
    await queryClient.invalidateQueries({ queryKey: ['orders-desk'] });
    await queryClient.invalidateQueries({ queryKey: ['section-counts'] });
  };

  const transition = useMutation({
    mutationFn: async (args: { path: 'send' | 'submit-for-approval' | 'approve'; success: string }) => {
      if (args.path === 'send' && data?.status === 'DRAFT') await apiFetch(`/api/v1/quotations/${params.id}`, { method: 'PATCH', body: JSON.stringify(draftPayload()) });
      await apiFetch(`/api/v1/quotations/${params.id}/${args.path}`, { method: 'POST', body: JSON.stringify({}) });
      return args.success;
    },
    onSuccess: async (success) => {
      toast.success(success);
      setHydratedFor(null);
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const send = () => transition.mutate({ path: 'send', success: t('sendQuotation') });
  const submitForApproval = () => transition.mutate({ path: 'submit-for-approval', success: tSales('desk.sentForApproval') });
  const approve = () => transition.mutate({ path: 'approve', success: tSales('desk.approved') });
  const rejectMutation = useMutation({
    mutationFn: (reason?: string) => apiFetch(`/api/v1/quotations/${params.id}/reject`, { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) }),
    onSuccess: async () => {
      toast.success(t('reject'));
      setRejectOpen(false);
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const saveDraftMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/quotations/${params.id}`, { method: 'PATCH', body: JSON.stringify(draftPayload()) }),
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      setHydratedFor(null);
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const reviseMutation = useMutation({
    mutationFn: () => apiFetch<{ id: string }>(`/api/v1/quotations/${params.id}/revise`, { method: 'POST' }),
    onSuccess: (revised) => {
      toast.success(tc('revisionCreated'));
      router.push(`/admin/quotations/${revised.id}`);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const isDraft = data?.status === 'DRAFT';
  const totals = useMemo(() => {
    return (data?.lines ?? []).reduce(
      (acc, line) => {
        const unit = Number(draftPrices[line.id] ?? line.unitPrice);
        const qty = Number(line.quantity) || 0;
        const net = Number.isFinite(unit) && unit > 0 ? unit * qty : 0;
        const rateRaw = line.taxRate == null || line.taxRate === '' ? 0.16 : Number(line.taxRate);
        const rate = Number.isFinite(rateRaw) ? rateRaw : 0.16;
        acc.subtotal += net;
        acc.tax += net * rate;
        acc.total = acc.subtotal + acc.tax;
        if (net === 0) acc.missing += 1;
        return acc;
      },
      { subtotal: 0, tax: 0, total: 0, missing: 0 },
    );
  }, [data?.lines, draftPrices]);

  if (detail.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} header={false} className="h-52" />
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <BoardSkeleton rows={5} />
          </div>
          <div className="xl:col-span-5">
            <BoardSkeleton rows={4} />
          </div>
        </div>
      </div>
    );
  }
  if (detail.isError || !data) return <ErrorBoard title={t('detail')} onRetry={() => detail.refetch()} />;

  const currency = data.currency ?? 'ILS';
  const canReject = ['INTERNAL_REVIEW', 'APPROVED', 'SENT', 'VIEWED'].includes(data.status);
  const canSend = ['DRAFT', 'INTERNAL_REVIEW', 'APPROVED'].includes(data.status);
  const canSubmitApproval = data.status === 'DRAFT' && (data.approvalChain?.length ?? 0) > 0;
  const canApprove = data.status === 'INTERNAL_REVIEW' && can(me.data, 'quotation.approve');
  const canRevise = ['APPROVED', 'SENT', 'REJECTED', 'REVISION_REQUESTED', 'VIEWED', 'EXPIRED'].includes(data.status);
  const displayTotal = isDraft ? totals.total : Number(data.total);
  const statusLabel = presentQuotationStatus(copy.locale, data.status, data.commerciallyExpired);
  const customerLabel = data.customer ? localizedName(copy.locale, data.customer, data.customer.name) : '—';
  const tone: BoardTone = data.commerciallyExpired ? 'neutral' : quotationTone(data.status);
  const expiryDays = daysUntil(data.expirationDate);
  const dirty = isDraft && (expirationDate !== anyToYmd(data.expirationDate) || offeredDeliveryDate !== anyToYmd(data.offeredDeliveryDate) || (data.lines ?? []).some((l) => (draftPrices[l.id] ?? null) !== (Number(l.unitPrice) > 0 ? Number(l.unitPrice) : null)));

  const chain = data.approvalChain ?? [];
  const done = new Set(data.completedApprovalSteps ?? []);
  const journey: StageStripStage[] = [
    { key: 'draft', label: copy.status('DRAFT'), state: data.status === 'DRAFT' ? 'current' : 'done' },
    ...chain.map((role): StageStripStage => ({ key: role, label: copy.status(role), state: done.has(role) ? 'done' : data.status === 'INTERNAL_REVIEW' && data.pendingApproverRole === role ? 'current' : 'todo' })),
    { key: 'sent', label: copy.status('SENT'), state: ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'REVISION_REQUESTED'].includes(data.status) ? (data.status === 'SENT' || data.status === 'VIEWED' ? 'current' : 'done') : 'todo' },
    {
      key: 'answer',
      label: data.status === 'REJECTED' ? copy.status('REJECTED') : data.status === 'REVISION_REQUESTED' ? copy.status('REVISION_REQUESTED') : copy.status('ACCEPTED'),
      state: data.status === 'ACCEPTED' ? 'done' : data.status === 'REJECTED' || data.status === 'REVISION_REQUESTED' ? 'blocked' : 'todo',
    },
  ];

  const attention: Array<{ id: string; tone: BoardTone; title: string; why: string; action?: string; onClick?: () => void }> = [];
  if (data.commerciallyExpired) attention.push({ id: 'expired', tone: 'neutral', title: copy.status('EXPIRED'), why: t('expiredCannotAccept'), action: canRevise ? tc('revise') : undefined, onClick: canRevise ? () => reviseMutation.mutate() : undefined });
  if (data.rejectionReason) attention.push({ id: 'rejected', tone: 'error', title: t('rejectionReason'), why: data.rejectionReason, action: canRevise ? tc('revise') : undefined, onClick: canRevise ? () => reviseMutation.mutate() : undefined });
  if (data.pendingApproverRole) attention.push({ id: 'approval', tone: 'warning', title: tc('pendingApproval'), why: tSales('desk.pendingApproverWhy', { role: copy.status(data.pendingApproverRole) }), action: canApprove ? tSales('desk.approve') : undefined, onClick: canApprove ? approve : undefined });
  if (isDraft && totals.missing > 0) attention.push({ id: 'prices', tone: 'warning', title: t('priceRequired'), why: tSales('desk.missingPricesWhy', { count: totals.missing }) });
  if (!data.commerciallyExpired && (data.status === 'SENT' || data.status === 'VIEWED') && expiryDays != null && expiryDays <= 3)
    attention.push({ id: 'expiring', tone: expiryDays < 0 ? 'error' : 'warning', title: t('validUntil'), why: expiryDays < 0 ? tSales('desk.expiredDays', { count: Math.abs(expiryDays) }) : tSales('desk.expiresIn', { count: expiryDays }) });

  const primary = canApprove ? (
    <InkPill onClick={approve} disabled={transition.isPending}>
      {tSales('desk.approve')}
    </InkPill>
  ) : canSend ? (
    <InkPill onClick={send} disabled={transition.isPending || (isDraft && totals.missing > 0)}>
      {t('sendQuotation')}
    </InkPill>
  ) : canRevise ? (
    <InkPill onClick={() => reviseMutation.mutate()} disabled={reviseMutation.isPending}>
      {tc('revise')}
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
        { id: 'pdf', label: tc('pdf'), onSelect: () => openPdf({ path: `/api/v1/quotations/${params.id}/pdf`, documentName: `${t('title')} ${data.number}`, filename: `${data.number}.pdf` }) },
        ...(isDraft ? [{ id: 'save', label: tCommon('save'), onSelect: () => saveDraftMutation.mutate() }] : []),
        ...(canSubmitApproval ? [{ id: 'submit', label: tSales('desk.submitForApproval'), onSelect: submitForApproval }] : []),
        ...(canRevise && primary?.props?.children !== tc('revise') ? [{ id: 'revise', label: tc('revise'), onSelect: () => reviseMutation.mutate() }] : []),
        ...(data.request ? [{ id: 'rfq', label: `${tc('rfq')} ${data.request.number}`, href: `/admin/requests/${data.request.id}` }] : []),
        ...(data.salesOrder ? [{ id: 'so', label: `${tSales('title')} ${data.salesOrder.number}`, href: `/admin/sales-orders/${data.salesOrder.id}` }] : []),
        ...(canReject ? [{ id: 'reject', label: t('reject'), tone: 'error' as const, separator: true, onSelect: () => setRejectOpen(true) }] : []),
      ]}
    />
  );

  const columns: DataColumn<QuoteLine>[] = [
    {
      key: 'description',
      header: tc('description'),
      cell: (line) => {
        const complexity = line.manufacturingComplexity === 'MODIFIED' || line.manufacturingComplexity === 'CUSTOM' ? line.manufacturingComplexity : 'STANDARD';
        const specs = [[line.width, line.height, line.depth].filter((v) => v != null).join(' × ') ? `${[line.width, line.height, line.depth].filter((v) => v != null).join(' × ')} cm` : null, line.material, line.fabric, line.color].filter(Boolean) as string[];
        return (
          <span className="flex items-start gap-3">
            <Stamp tone={complexity === 'CUSTOM' ? 'warning' : complexity === 'MODIFIED' ? 'info' : 'neutral'} className="mt-[7px]" />
            <span className="min-w-0">
              <span className="block font-semibold text-[var(--maher-text-primary)]">{line.description}</span>
              <span className="block text-[12px] text-[var(--maher-text-secondary)]">
                <span className="text-[var(--maher-brand)]">{t(`complexity.${complexity}` as never)}</span>
                {specs.length ? ` · ${specs.join(' · ')}` : ''}
              </span>
            </span>
          </span>
        );
      },
    },
    { key: 'qty', header: tc('qty'), numeric: true, width: '72px', cell: (line) => String(line.quantity) },
    {
      key: 'price',
      header: tc('price'),
      numeric: true,
      width: isDraft ? '180px' : '120px',
      cell: (line) => {
        const unit = Number(draftPrices[line.id] ?? line.unitPrice);
        if (isDraft) {
          return <MoneyField aria-label={tc('price')} currency={currency} value={draftPrices[line.id] ?? null} onChange={(v) => setDraftPrices((prev) => ({ ...prev, [line.id]: v }))} min={0} />;
        }
        return !Number.isFinite(unit) || unit <= 0 ? <Stamp tone="warning" size="sm">{t('priceRequired')}</Stamp> : copy.money(unit, currency);
      },
    },
    {
      key: 'total',
      header: tCommon('total'),
      numeric: true,
      width: '120px',
      cell: (line) => {
        const unit = Number(draftPrices[line.id] ?? line.unitPrice);
        const qty = Number(line.quantity) || 0;
        return !Number.isFinite(unit) || unit <= 0 ? '—' : copy.money(unit * qty, currency);
      },
    },
  ];

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        LinkComponent={Link}
        back={{ label: tNav('quotations'), href: '/admin/quotations' }}
        code={`${data.number}${data.version && data.version > 1 ? ` · v${data.version}` : ''}`}
        title={customerLabel}
        subtitle={[data.request ? `${tc('rfq')} ${data.request.number}` : null, data.request?.externalOrderNumber ? `${tSales('dealerOrderNumber')} ${data.request.externalOrderNumber}` : null].filter(Boolean).join(' · ') || undefined}
        status={{ label: statusLabel, tone }}
        facts={[
          { label: t('total'), value: copy.money(displayTotal, currency), ltr: true },
          { label: t('validUntil'), value: data.expirationDate ? copy.date(data.expirationDate, { day: 'numeric', month: 'short', year: 'numeric' }) : '—', ltr: true, tone: expiryDays != null && expiryDays < 0 ? 'error' : expiryDays != null && expiryDays <= 3 ? 'warning' : undefined },
          { label: t('factoryDelivery'), value: data.offeredDeliveryDate ? copy.date(data.offeredDeliveryDate, { day: 'numeric', month: 'short', year: 'numeric' }) : '—', ltr: true },
          { label: tc('paymentTerms'), value: data.paymentTerms ?? '—' },
          { label: t('lines'), value: String(data.lines?.length ?? 0), ltr: true },
          ...(data.sentAt ? [{ label: copy.status('SENT'), value: copy.date(data.sentAt, { day: 'numeric', month: 'short', year: 'numeric' }), ltr: true }] : []),
        ]}
        primary={primary}
        actions={menu}
      >
        <StageStrip stages={journey} />
      </DetailHero>

      {attention.length ? (
        <Board tone={attention.some((a) => a.tone === 'error') ? 'error' : 'warning'} wash="top">
          <Board.Header title={tSales('desk.needsAttention')} meta={<Stamp tone={attention.some((a) => a.tone === 'error') ? 'error' : 'warning'} size="sm">{attention.length}</Stamp>} />
          <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
            {attention.map((a) => (
              <li key={a.id}>
                <Ticket tone={a.tone} title={a.title} why={a.why} action={a.action} onClick={a.onClick} wash={a.tone === 'error'} />
              </li>
            ))}
          </ul>
        </Board>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-7">
          <DataBoard<QuoteLine>
            title={t('lines')}
            description={isDraft ? tSales('desk.draftPricesHint') : undefined}
            tone={isDraft && totals.missing > 0 ? 'warning' : 'neutral'}
            columns={columns}
            rows={data.lines ?? []}
            rowKey={(l) => l.id}
            rowHref={isDraft ? undefined : (l) => `/admin/quotations/${params.id}/lines/${l.id}`}
            LinkComponent={Link}
            empty={<Board.Empty title={tSales('noLines')} />}
            footer={
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <span>{isDraft && totals.missing > 0 ? tSales('desk.missingPricesWhy', { count: totals.missing }) : tSales('desk.linesPriced')}</span>
                <Ltr className="font-semibold text-[var(--maher-text-primary)]">{copy.money(displayTotal, currency)}</Ltr>
              </div>
            }
          />

          {data.customerNotes || data.internalNotes ? (
            <Board tone="neutral" className="xl:flex-1">
              <Board.Header title={tc('notes')} />
              <Board.Body className="space-y-3" grow>
                {data.customerNotes ? (
                  <div>
                    <p className="text-[12px] text-[var(--maher-text-tertiary)]">{tSales('customerNotes')}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-6 text-[var(--maher-text-primary)]">{data.customerNotes}</p>
                  </div>
                ) : null}
                {data.internalNotes ? (
                  <div>
                    <p className="text-[12px] text-[var(--maher-text-tertiary)]">{tc('internalNotes')}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-6 text-[var(--maher-text-secondary)]">{data.internalNotes}</p>
                  </div>
                ) : null}
              </Board.Body>
            </Board>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          <Board tone={tone}>
            <Board.Header title={t('total')} description={tSales('desk.totalsHint')} />
            <Board.Body className="space-y-4">
              <Figure value={copy.money(displayTotal, currency)} label={tCommon('total')} locale={copy.locale} />
              <Ledger>
                <LedgerRow label={t('subtotal')} value={copy.money(isDraft ? totals.subtotal : Number(data.subtotal ?? totals.subtotal), currency)} />
                <LedgerRow label={t('tax')} value={copy.money(isDraft ? totals.tax : Number(data.taxTotal ?? totals.tax), currency)} />
                <LedgerRow label={tCommon('total')} value={copy.money(displayTotal, currency)} />
              </Ledger>
              <DocumentActions
                size="sm"
                actions={[{ id: 'pdf', kind: 'pdf', label: tc('pdf'), onClick: () => openPdf({ path: `/api/v1/quotations/${params.id}/pdf`, documentName: `${t('title')} ${data.number}`, filename: `${data.number}.pdf` }) }]}
              />
            </Board.Body>
          </Board>

          <Board tone="neutral">
            <Board.Header title={t('detail')} />
            <Board.Body className="space-y-4">
              <KeyFacts
                columns={2}
                facts={[
                  { label: t('customer'), value: data.customer?.id ? <Link href={`/admin/customers/${data.customer.id}`} className="text-[var(--maher-brand)] hover:underline">{customerLabel}</Link> : customerLabel },
                  { label: tc('paymentTerms'), value: data.paymentTerms ?? '—' },
                  { label: tc('deliveryTerms'), value: data.deliveryTerms ?? '—' },
                  ...(data.request ? [{ label: tc('rfq'), value: <Link href={`/admin/requests/${data.request.id}`} className="text-[var(--maher-brand)] hover:underline"><Ltr>{data.request.number}</Ltr></Link> }] : []),
                ]}
              />
              {isDraft ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <DateField label={t('validUntil')} value={expirationDate} onChange={setExpirationDate} locale={copy.locale} copy={kit.date} minDate={anyToYmd(new Date())} />
                  <DateField label={t('factoryDelivery')} value={offeredDeliveryDate} onChange={setOfferedDeliveryDate} locale={copy.locale} copy={kit.date} minDate={anyToYmd(new Date())} />
                </div>
              ) : (
                <KeyFacts columns={2} facts={[{ label: t('validUntil'), value: anyToYmd(data.expirationDate) || '—', ltr: true }, { label: t('factoryDelivery'), value: anyToYmd(data.offeredDeliveryDate) || '—', ltr: true }]} />
              )}
            </Board.Body>
          </Board>

          {data.salesOrder ? (
            <Board tone="success" className="xl:flex-1">
              <Board.Header title={tSales('title')} />
              <Board.Body grow>
                <Link href={`/admin/sales-orders/${data.salesOrder.id}`} className="maher-press flex items-center justify-between rounded-[12px] border border-[var(--maher-border)] px-4 py-3 hover:bg-[var(--maher-surface-muted)]">
                  <span className="flex items-center gap-2.5">
                    <Stamp tone="success" />
                    <Ltr className="font-semibold text-[var(--maher-text-primary)]">{data.salesOrder.number}</Ltr>
                  </span>
                  <span className="text-[13px] text-[var(--maher-brand)]">{tCommon('details')}</span>
                </Link>
              </Board.Body>
            </Board>
          ) : null}
        </div>
      </div>

      {dirty ? (
        <FormFooter
          dirty
          dirtyLabel={kit.unsaved}
          secondary={
            <Button
              variant="ghost"
              onClick={() => {
                setHydratedFor(null);
              }}
            >
              {tCommon('cancel')}
            </Button>
          }
          primary={
            <Button onClick={() => saveDraftMutation.mutate()} loading={saveDraftMutation.isPending}>
              {tCommon('save')}
            </Button>
          }
        />
      ) : null}

      <ActionDock className="md:hidden" note={<Ltr>{data.number}</Ltr>}>
        {menu}
        {primary}
      </ActionDock>

      <ConfirmDialog
        open={rejectOpen}
        title={t('reject')}
        description={tSales('desk.rejectQuoteHint')}
        confirmLabel={t('reject')}
        cancelLabel={tCommon('cancel')}
        danger
        withReason
        reasonLabel={t('rejectionReason')}
        loading={rejectMutation.isPending}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
        onClose={() => setRejectOpen(false)}
      />
      {pdfDialog}
    </div>
  );
}
