'use client';

import { daysUntil, dueTone, isClosedSalesOrder, salesOrderTone, useOrdersCopy, type JourneyBucket } from '@/components/orders/orders-shared';
import { CancelImpactSheet } from '@/components/sales-orders/cancel-impact-sheet';
import { OrderWorkflowSection } from '@/components/workflow/order-workflow-section';
import { Link, useRouter } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch, fetchOrderProductionSetup, type OrderProductionSetup } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { localizedName } from '@maher/i18n';
import {
  ActionDock,
  Attachments,
  Board,
  BoardSkeleton,
  Button,
  ConfirmDialog,
  DateField,
  DetailHero,
  ErrorBoard,
  Figure,
  InkPill,
  KeyFacts,
  Ledger,
  LedgerRow,
  ListRow,
  ListRows,
  Ltr,
  Menu,
  Meter,
  MoneyField,
  RowThumb,
  Sheet,
  StageStrip,
  Stamp,
  TextArea,
  Ticket,
  anyToYmd,
  useToast,
  type BoardTone,
  type StageStripStage,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface CustomerRequestItem {
  id: string;
  itemNumber?: string | null;
  itemLetter?: string | null;
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
  documents?: Array<{ id: string; fileName: string; mimeType: string; storageKey: string }>;
  originalText?: string | null;
  translatedText?: string | null;
  detectedLanguage?: string | null;
  targetLanguage?: string | null;
}

interface SalesOrderDetail {
  id: string;
  number: string;
  status: string;
  currency?: string | null;
  total?: string | number;
  manufacturingCost?: string | number | null;
  sellerPrice?: string | number | null;
  productionPrice?: string | number | null;
  profit?: string | number | null;
  costBreakdown?: Record<string, number> | null;
  manufacturingCosting?: {
    status?: string | null;
    incomplete?: boolean;
    estimatedTotal?: number | null;
    actualTotal?: number | null;
    varianceCost?: number | null;
    variancePct?: number | null;
    scrapCost?: number | null;
    finalizedAt?: string | null;
  } | null;
  projectName?: string | null;
  requiredDeliveryDate?: string | null;
  requestedDeliveryDate?: string | null;
  committedDeliveryDate?: string | null;
  deliveryAddress?: string | null;
  externalOrderNumber?: string | null;
  notes?: string | null;
  createdAt?: string;
  orderDate?: string | null;
  productionSetupRequired?: boolean;
  journeyBucket?: JourneyBucket | null;
  customer?: { id: string; name: string; code?: string; phone?: string; fax?: string | null; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null };
  quotation?: { id: string; number: string; status: string } | null;
  customerRequest?: CustomerRequest | null;
  orderedItems?: CustomerRequestItem[];
  productionOrders?: Array<{ id: string; number: string; status: string; progressPercent?: number | null; currentStageCode?: string | null; salesOrderLineId?: string | null }>;
  invoices?: Array<{ id: string; number: string; status: string; total?: string | number; outstandingAmount?: string | number }>;
  deliveries?: Array<{ id: string; number: string; status: string; deliveryDate?: string | null }>;
  returns?: Array<{ id: string; number: string; approvalStatus: string; reason: string; productDesc: string; quantity?: string | number }>;
  commercialSummary?: {
    salesOrderId: string;
    number: string;
    orderTotal: number;
    commercialComplete: boolean;
    commercialBlock?: { ok: false; code: string; message: string } | null;
    lines: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      manufacturingComplexity?: string | null;
      productId?: string | null;
      commercialPriceStatus: string;
      commercialPriceSource?: string | null;
      commercialPriceNote?: string | null;
    }>;
  } | null;
  commercialGrossDifference?: { available: boolean; reason?: string | null; saleTotal: number; manufacturingCost: number | null; grossDifference: number | null } | null;
}

const HOLDABLE = new Set(['CONFIRMED', 'READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'WAITING_FOR_MATERIALS', 'WAITING_FOR_PAYMENT']);
const DELIVERY_EDITABLE = new Set(['DRAFT', 'CONFIRMED', 'WAITING_FOR_PAYMENT', 'WAITING_FOR_MATERIALS', 'READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'ON_HOLD']);

function dim(item: { width?: string | number | null; height?: string | number | null; depth?: string | number | null }) {
  const parts = [item.width, item.height, item.depth].map((v) => (v != null && String(v) !== '' ? String(v) : null)).filter(Boolean);
  return parts.length ? `${parts.join(' × ')} cm` : null;
}

/** Journey from the order status + production orders + deliveries (mirrors the API lane classifier). */
function journeyStages(order: SalesOrderDetail, labels: (b: JourneyBucket) => string): StageStripStage[] {
  const buckets: JourneyBucket[] = ['preparing', 'ready_to_start', 'in_production', 'ready_to_ship', 'shipped', 'delivered'];
  const status = order.status;
  const delivered = status === 'DELIVERED' || status === 'COMPLETED';
  const shipped = (order.deliveries ?? []).some((d) => d.status === 'OUT_FOR_DELIVERY') || delivered;
  const readyToShip = status === 'READY_FOR_DELIVERY' || shipped;
  const inProduction = status === 'IN_PRODUCTION' || (order.productionOrders ?? []).some((po) => ['IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_PACKAGING', 'ON_HOLD', 'COMPLETED'].includes(po.status)) || readyToShip;
  const readyToStart = status === 'READY_FOR_PRODUCTION' || (order.productionOrders?.length ?? 0) > 0 || inProduction;
  const reached: Record<JourneyBucket, boolean> = { preparing: true, ready_to_start: readyToStart, in_production: inProduction, ready_to_ship: readyToShip, shipped, delivered };
  const currentIdx = buckets.reduce((acc, b, i) => (reached[b] ? i : acc), 0);
  const blocked = status === 'ON_HOLD' || status === 'WAITING_FOR_MATERIALS' || status === 'WAITING_FOR_PAYMENT';
  return buckets.map((b, i) => ({
    key: b,
    label: labels(b),
    state: status === 'CANCELLED' ? (i <= currentIdx ? 'skipped' : 'todo') : i < currentIdx || (i === currentIdx && delivered) ? 'done' : i === currentIdx ? (blocked ? 'blocked' : 'current') : 'todo',
  }));
}

export default function SalesOrderDetailPage({ params }: { params: { id: string } }) {
  const copy = useOrdersCopy();
  const kit = useKitCopy();
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tCustomers = useTranslations('customers');
  const ta = useTranslations('accounting');
  const tc = useTranslations('catalog');
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [holdOpen, setHoldOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [dateReason, setDateReason] = useState('');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({ queryKey: ['sales-order', params.id], queryFn: () => apiFetch<SalesOrderDetail>(`/api/v1/sales-orders/${params.id}`) });
  const order = detail.data;

  const setup = useQuery({
    queryKey: ['order-production-setup', params.id],
    queryFn: () => fetchOrderProductionSetup(params.id),
    enabled:
      Boolean(order) &&
      (order!.productionSetupRequired === true ||
        order!.status === 'DRAFT' ||
        (order!.productionOrders?.length ?? 0) > 0 ||
        ['READY_FOR_PRODUCTION', 'WAITING_FOR_MATERIALS', 'IN_PRODUCTION', 'CONFIRMED'].includes(order!.status)),
    retry: false,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sales-order', params.id] });
    await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    await queryClient.invalidateQueries({ queryKey: ['orders-desk'] });
  };

  const holdMutation = useMutation({
    mutationFn: (reason?: string) => apiFetch(`/api/v1/sales-orders/${params.id}/hold`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: async () => {
      setError(null);
      setHoldOpen(false);
      toast.success(tSales('heldBanner'));
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const resumeMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/sales-orders/${params.id}/resume`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: async () => {
      toast.success(tSales('resumedBanner'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const confirmMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/sales-orders/${params.id}/confirm`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success(tSales('confirmedBanner'));
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const dateMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/sales-orders/${params.id}/committed-delivery`, { method: 'POST', body: JSON.stringify({ date: dateDraft, reason: dateReason.trim() || undefined }) }),
    onSuccess: async () => {
      setDateOpen(false);
      setDateReason('');
      toast.success(tSales('desk.deliveryDateUpdated'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const promoteMutation = useMutation({
    mutationFn: (args: { lineId: string; productId?: string | null }) =>
      args.productId
        ? apiFetch(`/api/v1/products/${args.productId}/variants/from-order-line/${args.lineId}`, { method: 'POST', body: JSON.stringify({}) })
        : apiFetch(`/api/v1/products/from-order-line/${args.lineId}`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: async () => {
      toast.success(tc('promotedFromOrder'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const confirmPricesMutation = useMutation({
    mutationFn: (lines: Array<{ lineId: string; unitPrice: number; note?: string }>) =>
      apiFetch(`/api/v1/sales-orders/${params.id}/confirm-commercial-prices`, { method: 'POST', body: JSON.stringify({ lines }) }),
    onSuccess: async () => {
      toast.success(ta('commercialPricesConfirmed'));
      setPriceDrafts({});
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const items = useMemo(() => {
    if (!order) return [];
    const req = order.customerRequest;
    return (req?.items?.length ? req.items : order.orderedItems ?? []).map((item, index) => ({ ...item, itemNumber: item.itemNumber ?? order.orderedItems?.[index]?.itemNumber ?? null }));
  }, [order]);

  if (detail.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} header={false} className="h-56" />
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <BoardSkeleton rows={5} />
            <BoardSkeleton rows={3} />
          </div>
          <div className="space-y-5 xl:col-span-5">
            <BoardSkeleton rows={4} />
            <BoardSkeleton rows={3} />
          </div>
        </div>
      </div>
    );
  }
  if (detail.isError || !order) {
    return <ErrorBoard title={tSales('detail')} onRetry={() => detail.refetch()} />;
  }

  const currency = order.currency ?? 'ILS';
  const customerName = order.customer ? localizedName(copy.locale, order.customer, order.customer.name) : undefined;
  const req = order.customerRequest;
  const cb = order.costBreakdown ?? {};
  const seller = Number(order.sellerPrice ?? order.total ?? 0);
  const production = Number(order.productionPrice ?? order.manufacturingCost ?? 0);
  const profit = Number(order.profit ?? seller - production);
  const committed = order.committedDeliveryDate ?? order.requiredDeliveryDate ?? order.requestedDeliveryDate ?? req?.requiredDeliveryDate ?? null;
  const requested = order.requestedDeliveryDate ?? req?.requiredDeliveryDate ?? null;
  const days = daysUntil(committed);
  const closed = isClosedSalesOrder(order.status);
  const tone: BoardTone = salesOrderTone(order.status);
  const dealerOrderNo = order.externalOrderNumber?.trim() || req?.externalOrderNumber?.trim() || null;
  const needsProductionSetup = order.productionSetupRequired === true || (order.status === 'DRAFT' && (order.productionOrders?.length ?? 0) === 0);
  const setupData = setup.data as OrderProductionSetup | undefined;
  const setupReleased = setupData?.status === 'RELEASED';
  const commercial = order.commercialSummary;
  const requiredPriceLines = (commercial?.lines ?? []).filter((l) => String(l.commercialPriceStatus).toUpperCase() === 'REQUIRED');
  const customLines = (commercial?.lines ?? []).filter((l) => String(l.manufacturingComplexity).toUpperCase() === 'CUSTOM');
  const stages = journeyStages(order, copy.journey);

  const attention: Array<{ id: string; tone: BoardTone; title: string; why: string; href?: string; action?: string; onClick?: () => void }> = [];
  if (needsProductionSetup) attention.push({ id: 'setup', tone: 'warning', title: tSales('orderAcceptedSetup'), why: tSales('productionSetupRequired'), href: `/admin/sales-orders/${params.id}/production-plan`, action: tSales('prepareProduction') });
  if (setupReleased && (setupData?.progress.needsReviewLines ?? 0) === 0 && (order.productionOrders?.length ?? 0) > 0 && order.status === 'READY_FOR_PRODUCTION')
    attention.push({ id: 'assign', tone: 'info', title: tSales('orderSetup.workerAssignmentRequired'), why: tSales('orderSetup.workerAssignmentHint'), href: '/admin/production', action: tSales('orderSetup.openProduction') });
  if (requiredPriceLines.length) attention.push({ id: 'prices', tone: 'warning', title: ta('commercialSummary'), why: ta('requiredPriceLines', { count: requiredPriceLines.length }), href: '#commercial', action: ta('confirmCommercialPrices') });
  if (order.status === 'ON_HOLD') attention.push({ id: 'hold', tone: 'warning', title: copy.status('ON_HOLD'), why: tSales('desk.onHoldWhy'), action: tSales('resume'), onClick: () => resumeMutation.mutate() });
  if (!closed && days != null && days < 0) attention.push({ id: 'late', tone: 'error', title: tSales('desk.lateTitle'), why: copy.dueLabel(days), action: tSales('desk.changeDeliveryDate'), onClick: () => openDate() });

  function openDate() {
    setDateDraft(anyToYmd(committed));
    setDateOpen(true);
  }

  const menuItems = [
    ...(HOLDABLE.has(order.status) ? [{ id: 'hold', label: tSales('hold'), onSelect: () => setHoldOpen(true) }] : []),
    ...(order.status === 'ON_HOLD' ? [{ id: 'resume', label: tSales('resume'), onSelect: () => resumeMutation.mutate() }] : []),
    ...(DELIVERY_EDITABLE.has(order.status) ? [{ id: 'date', label: tSales('desk.changeDeliveryDate'), onSelect: openDate }] : []),
    ...(setupReleased ? [{ id: 'setup', label: tSales('orderSetup.viewSetup'), href: `/admin/sales-orders/${params.id}/production-plan` }] : []),
    { id: 'flow', label: tSales('desk.viewFlow'), href: `/admin/sales-orders/${params.id}/flow` },
    ...(order.quotation ? [{ id: 'quote', label: `${tSales('quotation')} ${order.quotation.number}`, href: `/admin/quotations/${order.quotation.id}` }] : []),
    ...(order.status !== 'CANCELLED' && !closed ? [{ id: 'cancel', label: tSales('cancelOrder'), tone: 'error' as const, separator: true, onSelect: () => setCancelOpen(true) }] : []),
  ];

  const primary =
    order.status === 'DRAFT' && !needsProductionSetup ? (
      <InkPill onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
        {tSales('confirmToProduction')}
      </InkPill>
    ) : needsProductionSetup ? (
      <Link href={`/admin/sales-orders/${params.id}/production-plan`} className="maher-press inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--maher-text-primary)] px-4 text-[13px] font-semibold text-[var(--maher-background)] hover:opacity-90">
        {tSales('prepareProduction')}
      </Link>
    ) : order.status === 'ON_HOLD' ? (
      <InkPill onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending}>
        {tSales('resume')}
      </InkPill>
    ) : (order.productionOrders?.length ?? 0) > 0 ? (
      <Link href={`/admin/production/${order.productionOrders![0]!.id}`} className="maher-press inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--maher-text-primary)] px-4 text-[13px] font-semibold text-[var(--maher-background)] hover:opacity-90">
        {tSales('desk.openProduction')}
      </Link>
    ) : null;

  const overflow = (
    <Menu
      LinkComponent={Link}
      items={menuItems}
      aria-label={tSales('moreActions')}
      trigger={
        <Button variant="secondary" size="icon" aria-label={tSales('moreActions')}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      }
    />
  );

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        LinkComponent={Link}
        back={{ label: tNav('salesOrders'), href: '/admin/sales-orders' }}
        code={order.number}
        title={customerName ?? order.number}
        subtitle={[order.projectName ?? req?.projectName, dealerOrderNo ? `${tSales('dealerOrderNumber')} ${dealerOrderNo}` : null].filter(Boolean).join(' · ') || undefined}
        status={{ label: copy.status(order.status), tone }}
        tone={!closed && days != null && days < 0 ? 'error' : tone}
        facts={[
          { label: tSales('deliveryDate'), value: committed ? copy.date(committed, { day: 'numeric', month: 'short', year: 'numeric' }) : '—', ltr: true, tone: dueTone(days, closed) },
          ...(days != null && !closed ? [{ label: tSales('desk.timeLeft'), value: copy.dueLabel(days), tone: dueTone(days, closed) }] : []),
          { label: tSales('sellerPrice'), value: copy.money(seller, currency), ltr: true },
          { label: tSales('productionPrice'), value: copy.money(production, currency), ltr: true },
          { label: tSales('profit'), value: copy.money(profit, currency), ltr: true, tone: profit < 0 ? 'error' : profit > 0 ? 'success' : 'neutral' },
          { label: tSales('lines'), value: String(items.length), ltr: true },
          ...(order.orderDate || order.createdAt ? [{ label: tSales('orderDate'), value: copy.date(order.orderDate ?? order.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }), ltr: true }] : []),
        ]}
        primary={primary}
        actions={overflow}
      >
        <StageStrip stages={stages} />
      </DetailHero>

      {attention.length ? (
        <Board tone={attention.some((a) => a.tone === 'error') ? 'error' : 'warning'} wash="top">
          <Board.Header title={tSales('desk.needsAttention')} meta={<Stamp tone={attention.some((a) => a.tone === 'error') ? 'error' : 'warning'} size="sm">{attention.length}</Stamp>} />
          <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
            {attention.map((a) => (
              <li key={a.id}>
                <Ticket tone={a.tone} title={a.title} why={a.why} action={a.action} href={a.href} LinkComponent={Link} onClick={a.onClick} wash={a.tone === 'error'} />
              </li>
            ))}
          </ul>
        </Board>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-7">
          {/* Lines */}
          <Board tone="brand">
            <Board.Header
              title={tSales('whatTheyOrdered')}
              description={tSales('desk.linesHint')}
              meta={req?.source ? <Stamp tone="neutral" size="sm">{copy.source(req.source)}</Stamp> : null}
            />
            {items.length === 0 ? (
              <Board.Empty title={tSales('noCustomerItems')} />
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
                {items.map((item) => {
                  const setupLine = setupData?.lines.find((line) => line.id === item.id || line.salesOrderLineId === item.id || line.description === item.productName);
                  const complexity = setupLine?.manufacturingComplexity;
                  const kind = complexity === 'CUSTOM' ? tc('lineKindCustom') : complexity === 'MODIFIED' ? tc('lineKindCustomized') : tc('lineKindStandard');
                  const po = (order.productionOrders ?? []).find((p) => p.salesOrderLineId === (setupLine?.salesOrderLineId ?? item.id));
                  const specs = [dim(item), item.fabricType ? `${tSales('fabric')}: ${item.fabricType}${item.fabricColor ? ` / ${item.fabricColor}` : ''}` : null, item.material ? `${tSales('material')}: ${item.material}` : null, item.woodType, item.foamDensity, item.finish, item.accessories].filter(Boolean) as string[];
                  return (
                    <li key={item.id} className="flex gap-4 px-5 py-4">
                      <RowThumb src={setupLine?.product?.imageUrl} className="h-14 w-14 rounded-[12px]" icon={<Stamp tone={complexity === 'CUSTOM' ? 'warning' : complexity === 'MODIFIED' ? 'info' : 'neutral'} />} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold leading-5 text-[var(--maher-text-primary)]">
                              {item.itemNumber ? <Ltr className="me-2 text-[12px] font-medium text-[var(--maher-text-tertiary)]">{item.itemNumber}</Ltr> : null}
                              {item.productName}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] leading-4 text-[var(--maher-text-secondary)]">
                              <span className="text-[var(--maher-brand)]">{kind}</span>
                              {setupLine ? (
                                <Stamp tone={setupLine.status === 'READY' || setupLine.status === 'RELEASED' ? 'success' : 'neutral'} size="sm">
                                  {copy.status(setupLine.status)}
                                </Stamp>
                              ) : null}
                              {po ? (
                                <Link href={`/admin/production/${po.id}`} className="hover:underline">
                                  <Ltr>{po.number}</Ltr>
                                </Link>
                              ) : null}
                            </p>
                          </div>
                          <Ltr className="text-[14px] font-semibold text-[var(--maher-text-primary)]">× {Number(item.quantity)}</Ltr>
                        </div>
                        {item.description ? <p className="mt-1.5 text-[13px] leading-5 text-[var(--maher-text-secondary)]">{item.description}</p> : null}
                        {specs.length ? (
                          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] leading-4 text-[var(--maher-text-tertiary)]">
                            {specs.map((s, i) => (
                              <span key={i} dir="auto">
                                {s}
                              </span>
                            ))}
                          </p>
                        ) : null}
                        {item.notes ? <p className="mt-1.5 text-[13px] leading-5 text-[var(--maher-text-secondary)]">{item.notes}</p> : null}
                        {po?.progressPercent != null ? (
                          <div className="mt-2 max-w-[260px]">
                            <Meter value={po.progressPercent} max={100} size="sm" tone="info" valueLabel={`${Math.round(po.progressPercent)}%`} label={copy.status(po.status)} />
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Board>

          {/* Customer + delivery facts */}
          <Board tone="neutral">
            <Board.Header title={tSales('customerOrder')} description={tSales('desk.customerFactsHint')} />
            <Board.Body>
              <KeyFacts
                columns={3}
                facts={[
                  {
                    label: tSales('customer'),
                    value: order.customer ? (
                      <Link href={`/admin/customers/${order.customer.id}`} className="text-[var(--maher-brand)] hover:underline">
                        {customerName}
                      </Link>
                    ) : (
                      '—'
                    ),
                  },
                  { label: tSales('endCustomer'), value: req?.endCustomerName ?? '—' },
                  { label: tSales('phone'), value: req?.endCustomerPhone ?? order.customer?.phone ?? '—', ltr: true },
                  { label: tCustomers('fax'), value: req?.endCustomerFax ?? order.customer?.fax ?? '—', ltr: true },
                  { label: tSales('dealerOrderNumber'), value: dealerOrderNo ?? '—', ltr: true },
                  { label: tSales('project'), value: req?.projectName ?? order.projectName ?? '—' },
                  { label: tSales('deliveryAddress'), value: req?.deliveryAddress ?? order.deliveryAddress ?? '—', wide: true },
                ]}
              />
            </Board.Body>
          </Board>

          {/* Notes */}
          {req?.translatedText || req?.originalText || req?.notes || order.notes ? (
            <Board tone="neutral">
              <Board.Header
                title={tSales('customerNotes')}
                meta={req?.detectedLanguage ? <span>{`${tSales('detectedLanguage')}: ${req.detectedLanguage}${req.targetLanguage ? ` → ${req.targetLanguage}` : ''}`}</span> : null}
              />
              <Board.Body className="space-y-3">
                {req?.translatedText || req?.notes ? <p className="whitespace-pre-wrap text-[14px] leading-6 text-[var(--maher-text-primary)]">{req?.translatedText ?? req?.notes}</p> : null}
                {order.notes && order.notes !== req?.notes ? <p className="whitespace-pre-wrap text-[13px] leading-5 text-[var(--maher-text-secondary)]">{order.notes}</p> : null}
                {req?.originalText && req.originalText !== req.translatedText ? (
                  <details className="text-[13px]">
                    <summary className="cursor-pointer text-[var(--maher-text-secondary)]">{tSales('originalHandwriting')}</summary>
                    <p className="mt-2 whitespace-pre-wrap rounded-[12px] border border-dashed border-[var(--maher-border)] p-3 text-[var(--maher-text-secondary)]">{req.originalText}</p>
                  </details>
                ) : null}
              </Board.Body>
            </Board>
          ) : null}

          {/* Attachments */}
          {(req?.documents?.length ?? 0) > 0 ? (
            <Board tone="neutral">
              <Board.Header title={tSales('attachments')} meta={<span className="tabular-nums">{req!.documents!.length}</span>} />
              <Board.Body>
                <Attachments
                  copy={kit.attachments}
                  items={req!.documents!.map((doc) => ({ id: doc.id, name: doc.fileName, mime: doc.mimeType, url: `/api/v1/uploads/documents/${doc.id}/link` }))}
                />
              </Board.Body>
            </Board>
          ) : null}

          {/* Released spec */}
          {setupData && setupReleased ? (
            <Board tone="success">
              <Board.Header
                title={tSales('orderSetup.releasedSpec')}
                description={tSales('orderSetup.releasedSpecHint')}
                actions={
                  <Link href={`/admin/sales-orders/${params.id}/production-plan`} className="text-[13px] font-medium text-[var(--maher-brand)] hover:underline">
                    {tSales('orderSetup.viewSetup')}
                  </Link>
                }
              />
              <ListRows>
                {setupData.lines.map((line) => {
                  const child = (order.productionOrders ?? []).find((po) => po.salesOrderLineId === line.salesOrderLineId);
                  const d = dim(line.orderDimensions ?? {});
                  return (
                    <ListRow
                      key={line.id}
                      href={child ? `/admin/production/${child.id}` : undefined}
                      LinkComponent={Link}
                      tone={line.materials?.length ? 'success' : 'neutral'}
                      title={line.manufacturingName ?? line.description ?? '—'}
                      meta={[child?.number, line.workflow ? localizedName(copy.locale, line.workflow, line.workflow.code) : null, d].filter(Boolean).join(' · ')}
                      trailing={
                        <span className="flex flex-col items-end text-[12px] text-[var(--maher-text-secondary)]">
                          <Ltr>× {line.quantity}</Ltr>
                          <span>{tSales('orderSetup.materialCount', { count: String(line.materials?.length ?? 0) })}</span>
                        </span>
                      }
                    />
                  );
                })}
              </ListRows>
            </Board>
          ) : null}

          {/* Workflow per production order */}
          {(order.productionOrders ?? []).map((po) => (
            <OrderWorkflowSection key={po.id} productionOrderId={po.id} title={po.number} />
          ))}
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          {/* Money */}
          <Board tone={profit < 0 ? 'error' : 'brand'} id="commercial">
            <Board.Header title={tSales('manufacturingCost')} description={tSales('fromInventoryCosts')} />
            <Board.Body className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Figure size="sm" value={copy.money(seller, currency)} label={tSales('sellerPrice')} locale={copy.locale} />
                <Figure size="sm" value={copy.money(production, currency)} label={tSales('productionPrice')} locale={copy.locale} />
                <Figure size="sm" value={copy.money(profit, currency)} label={tSales('profit')} tone={profit < 0 ? 'error' : profit > 0 ? 'success' : 'neutral'} locale={copy.locale} />
              </div>
              {seller > 0 ? <Meter value={Math.min(production, seller)} max={seller} size="sm" tone={production > seller ? 'error' : 'brand'} label={tSales('desk.costShare')} valueLabel={`${Math.round((production / seller) * 100)}%`} /> : null}
              <Ledger>
                {(
                  [
                    ['fabric', tSales('fabricCost'), cb.fabricQty, cb.fabricCost],
                    ['wood', tSales('woodCost'), cb.woodQty, cb.woodCost],
                    ['foam', tSales('foamCost'), cb.foamQty, cb.foamCost],
                    ['accessories', tSales('accessoriesCost'), cb.accessoriesQty, cb.accessoriesCost],
                  ] as const
                ).map(([key, label, qty, cost]) => (
                  <LedgerRow key={key} label={label} hint={qty != null && Number(qty) > 0 ? `× ${Number(qty)}` : undefined} value={copy.money(cost ?? 0, currency)} />
                ))}
              </Ledger>
              {order.manufacturingCosting ? (
                <div className="border-t border-[var(--maher-border)] pt-3">
                  <p className="mb-2 text-[13px] font-medium text-[var(--maher-text-primary)]">
                    {tSales('mfgCostTitle')}
                    <span className="ms-2 text-[12px] font-normal text-[var(--maher-text-tertiary)]">
                      {(() => {
                        const st = String(order.manufacturingCosting.status ?? '').toUpperCase();
                        if (st === 'FINAL') return tSales('mfgCostStatusFinal');
                        if (st === 'IN_PROGRESS') return tSales('mfgCostStatusInProgress');
                        if (st === 'INCOMPLETE') return tSales('mfgCostStatusIncomplete');
                        return tSales('mfgCostStatusEstimatedOnly');
                      })()}
                    </span>
                  </p>
                  <Ledger>
                    <LedgerRow label={tSales('mfgCostEstimated')} value={order.manufacturingCosting.estimatedTotal != null ? copy.money(order.manufacturingCosting.estimatedTotal, currency) : '—'} />
                    <LedgerRow label={tSales('mfgCostActual')} value={order.manufacturingCosting.actualTotal != null ? copy.money(order.manufacturingCosting.actualTotal, currency) : '—'} />
                    <LedgerRow
                      label={tSales('mfgCostVariance')}
                      value={order.manufacturingCosting.varianceCost != null ? copy.money(order.manufacturingCosting.varianceCost, currency) : '—'}
                      stamp={order.manufacturingCosting.varianceCost != null}
                      tone={order.manufacturingCosting.varianceCost != null ? (order.manufacturingCosting.varianceCost > 0 ? 'error' : 'success') : undefined}
                    />
                  </Ledger>
                </div>
              ) : null}
            </Board.Body>
            {commercial ? (
              <Board.Footer>
                <span>{commercial.commercialComplete ? ta('commercialComplete') : ta('commercialIncomplete')}</span>
                <Ltr className="font-medium text-[var(--maher-text-primary)]">{copy.money(commercial.orderTotal, currency)}</Ltr>
              </Board.Footer>
            ) : null}
          </Board>

          {/* Required prices */}
          {requiredPriceLines.length ? (
            <Board tone="warning" wash="top">
              <Board.Header title={ta('commercialSummary')} description={ta('requiredPriceLines', { count: requiredPriceLines.length })} />
              <Board.Body className="space-y-3">
                {requiredPriceLines.map((line) => (
                  <MoneyField
                    key={line.id}
                    label={line.description}
                    currency={currency}
                    value={priceDrafts[line.id] ?? (line.unitPrice > 0 ? line.unitPrice : null)}
                    onChange={(v) => setPriceDrafts((prev) => ({ ...prev, [line.id]: v }))}
                    min={0}
                  />
                ))}
              </Board.Body>
              <Board.Footer>
                <span />
                <Button
                  size="sm"
                  loading={confirmPricesMutation.isPending}
                  onClick={() => {
                    const lines = requiredPriceLines.map((line) => ({ lineId: line.id, unitPrice: Number(priceDrafts[line.id] ?? (line.unitPrice > 0 ? line.unitPrice : 0)) }));
                    if (lines.some((l) => !(l.unitPrice > 0))) {
                      toast.error(ta('commercialPriceInvalid'));
                      return;
                    }
                    confirmPricesMutation.mutate(lines);
                  }}
                >
                  {ta('confirmCommercialPrices')}
                </Button>
              </Board.Footer>
            </Board>
          ) : null}

          {/* Schedule */}
          <Board tone={dueTone(days, closed)}>
            <Board.Header
              title={tSales('desk.scheduleTitle')}
              actions={
                DELIVERY_EDITABLE.has(order.status) ? (
                  <button type="button" onClick={openDate} className="text-[13px] font-medium text-[var(--maher-brand)] hover:underline">
                    {tSales('desk.changeDeliveryDate')}
                  </button>
                ) : null
              }
            />
            <Board.Body>
              <Ledger>
                <LedgerRow label={tSales('dealerDeliveryDate')} value={requested ? copy.date(requested, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
                <LedgerRow
                  label={tSales('desk.committedDate')}
                  value={committed ? copy.date(committed, { day: 'numeric', month: 'short', year: 'numeric' }) : tSales('noDeliveryDateYet')}
                  hint={days != null && !closed ? copy.dueLabel(days) : undefined}
                  stamp={dueTone(days, closed) !== 'neutral'}
                  tone={dueTone(days, closed) === 'neutral' ? undefined : dueTone(days, closed)}
                />
                {(order.deliveries ?? []).map((d) => (
                  <LedgerRow key={d.id} label={d.number} hint={copy.status(d.status)} value={d.deliveryDate ? copy.date(d.deliveryDate) : '—'} href={`/admin/deliveries/${d.id}`} LinkComponent={Link} />
                ))}
              </Ledger>
            </Board.Body>
          </Board>

          {/* Production orders */}
          <Board tone={(order.productionOrders ?? []).some((po) => po.status === 'ON_HOLD' || po.status === 'BLOCKED') ? 'warning' : 'info'}>
            <Board.Header title={tSales('linkedProduction')} meta={<span className="tabular-nums">{order.productionOrders?.length ?? 0}</span>} />
            {(order.productionOrders ?? []).length ? (
              <ListRows>
                {order.productionOrders!.map((po) => (
                  <ListRow
                    key={po.id}
                    href={`/admin/production/${po.id}`}
                    LinkComponent={Link}
                    tone={po.status === 'COMPLETED' ? 'success' : po.status === 'ON_HOLD' || po.status === 'BLOCKED' ? 'warning' : 'info'}
                    title={<Ltr>{po.number}</Ltr>}
                    meta={copy.status(po.status)}
                    trailing={po.progressPercent != null ? <span className="w-24"><Meter value={po.progressPercent} max={100} size="sm" showValue={false} tone="info" /></span> : null}
                  />
                ))}
              </ListRows>
            ) : (
              <Board.Empty title={tSales('noProductionYet')} />
            )}
          </Board>

          {/* Invoices + returns */}
          <Board tone={(order.returns ?? []).length ? 'warning' : 'neutral'} className="xl:flex-1">
            <Board.Header title={tSales('desk.paperwork')} description={tSales('desk.paperworkHint')} />
            <Board.Body padding="none" grow>
              {(order.invoices ?? []).length || (order.returns ?? []).length || order.quotation ? (
                <ListRows>
                  {order.quotation ? (
                    <ListRow href={`/admin/quotations/${order.quotation.id}`} LinkComponent={Link} tone="neutral" title={<Ltr>{order.quotation.number}</Ltr>} meta={`${tSales('quotation')} · ${copy.status(order.quotation.status)}`} />
                  ) : null}
                  {(order.invoices ?? []).map((inv) => (
                    <ListRow
                      key={inv.id}
                      href={`/admin/invoices/${inv.id}`}
                      LinkComponent={Link}
                      tone={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'error' : 'info'}
                      title={<Ltr>{inv.number}</Ltr>}
                      meta={`${tNav('invoices')} · ${copy.status(inv.status)}`}
                      trailing={<span>{inv.total != null ? copy.money(inv.total, currency) : ''}</span>}
                    />
                  ))}
                  {(order.returns ?? []).map((r) => (
                    <ListRow key={r.id} href={`/admin/returns/${r.id}`} LinkComponent={Link} tone="warning" title={<Ltr>{r.number}</Ltr>} meta={`${r.productDesc} · ${copy.status(r.approvalStatus)}`} />
                  ))}
                </ListRows>
              ) : (
                <Board.Empty title={tSales('desk.paperworkEmpty')} description={tSales('desk.paperworkEmptyBody')} />
              )}
            </Board.Body>
          </Board>

          {/* Promote custom lines */}
          {customLines.length ? (
            <Board tone="brand">
              <Board.Header title={tc('promoteFromOrder')} description={tSales('desk.promoteHint')} />
              <ListRows>
                {customLines.map((line) => (
                  <ListRow
                    key={line.id}
                    tone="warning"
                    title={line.description}
                    meta={tc('lineKindCustom')}
                    chevron={false}
                    trailing={
                      <span className="flex gap-1.5">
                        <Button size="sm" variant="secondary" loading={promoteMutation.isPending} onClick={() => promoteMutation.mutate({ lineId: line.id })}>
                          {tc('promoteFromOrder')}
                        </Button>
                        {line.productId ? (
                          <Button size="sm" variant="ghost" loading={promoteMutation.isPending} onClick={() => promoteMutation.mutate({ lineId: line.id, productId: line.productId })}>
                            {tc('promoteVariantFromOrder')}
                          </Button>
                        ) : null}
                      </span>
                    }
                  />
                ))}
              </ListRows>
            </Board>
          ) : null}
        </div>
      </div>

      <ActionDock className="md:hidden" note={<Ltr>{order.number}</Ltr>}>
        {overflow}
        {primary}
      </ActionDock>

      <ConfirmDialog
        open={holdOpen}
        title={tSales('hold')}
        description={tSales('holdDescription')}
        confirmLabel={tSales('hold')}
        cancelLabel={tCommon('cancel')}
        withReason
        reasonLabel={tCommon('reason')}
        loading={holdMutation.isPending}
        error={error}
        onConfirm={(reason) => holdMutation.mutate(reason)}
        onClose={() => setHoldOpen(false)}
      />
      <Sheet
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        title={tSales('desk.changeDeliveryDate')}
        description={tSales('desk.changeDeliveryDateHint')}
        tone="brand"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={dateMutation.isPending} disabled={!dateDraft} onClick={() => dateMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <DateField label={tSales('desk.committedDate')} value={dateDraft} onChange={setDateDraft} locale={copy.locale} copy={kit.date} minDate={anyToYmd(new Date())} presentation="popover" />
          <TextArea autoGrow label={tCommon('reason')} value={dateReason} onChange={(e) => setDateReason(e.target.value)} rows={3} />
        </div>
      </Sheet>
      <CancelImpactSheet
        open={cancelOpen}
        salesOrderId={params.id}
        onClose={() => setCancelOpen(false)}
        onCancelled={({ financialAttention }) => {
          void invalidate();
          toast.success(tSales('cancelledBanner'), financialAttention ? tSales('cancelImpact.financialAttentionBannerBody') : undefined);
          router.refresh();
        }}
      />
    </div>
  );
}
