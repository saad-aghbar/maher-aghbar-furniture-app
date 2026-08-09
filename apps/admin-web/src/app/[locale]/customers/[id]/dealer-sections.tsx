'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, FileText, Receipt, Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

type DealerTab =
  | 'orders'
  | 'production'
  | 'completed'
  | 'soa'
  | 'payments'
  | 'invoices'
  | 'priceList';

interface CatalogProduct {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string;
  nameHe?: string;
  basePrice?: string | number | null;
}

interface DealerPriceRow {
  id: string;
  price: unknown;
  currency: string;
  productId?: string;
  product?: {
    id?: string;
    sku: string;
    nameEn: string;
    nameAr?: string;
    nameHe?: string;
    basePrice?: unknown;
    manufacturingCost?: unknown;
    imageUrl?: string | null;
  };
}

function pageSlice<T>(items: T[], page: number, pageSize: number) {
  const size = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((safePage - 1) * size, safePage * size),
    page: safePage,
    totalPages,
    total: items.length,
  };
}

type GridFitKind = 'order' | 'list';

function useGridFit(kind: GridFitKind, remountKey: string) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ cols: kind === 'order' ? 5 : 3, pageSize: kind === 'order' ? 10 : 6 });

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const gap = 12;
    const minCardW = kind === 'order' ? 168 : 280;
    const cardH = kind === 'order' ? 272 : 132;
    const maxCols = kind === 'order' ? 6 : 3;
    const maxRows = kind === 'order' ? 3 : 4;

    const measure = () => {
      const width = el.clientWidth || el.getBoundingClientRect().width;
      if (width < 40) return;
      const cols = Math.max(1, Math.min(maxCols, Math.floor((width + gap) / (minCardW + gap))));
      const top = el.getBoundingClientRect().top;
      const availableH = Math.max(cardH, window.innerHeight - top - 56);
      const rows = Math.max(1, Math.min(maxRows, Math.floor((availableH + gap) / (cardH + gap))));
      const pageSize = cols * rows;
      setFit((prev) =>
        prev.cols === cols && prev.pageSize === pageSize ? prev : { cols, pageSize },
      );
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [kind, remountKey]);

  return { hostRef, cols: fit.cols, pageSize: fit.pageSize };
}

function SummaryPager({
  page,
  totalPages,
  onChange,
  previousLabel,
  nextLabel,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        {previousLabel}
      </Button>
      <span className="text-sm text-text-secondary tabular-nums" dir="ltr">
        {page} / {totalPages}
      </span>
      <Button
        size="sm"
        variant="secondary"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        {nextLabel}
      </Button>
    </div>
  );
}

interface SalesOrderRow {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  manufacturingCost?: string | number | null;
  sellerPrice?: string | number | null;
  productionPrice?: string | number | null;
  progressPercent?: number | null;
  title?: string | null;
  imageUrl?: string | null;
  requiredDeliveryDate?: string | null;
  externalOrderNumber?: string | null;
  productionOrders?: Array<{ status: string }>;
  quotation?: {
    request?: {
      endCustomerName?: string | null;
      externalOrderNumber?: string | null;
    } | null;
  } | null;
}

interface ProductionRow {
  id: string;
  number: string;
  status: string;
  progressPercent: number;
  productDescription: string;
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null } | null;
}

interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  total: unknown;
  outstandingAmount: unknown;
  issueDate?: string | null;
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null } | null;
}

interface PaymentRow {
  id: string;
  number: string;
  amount: unknown;
  method?: string;
  paymentDate?: string;
}

const WAITING = new Set([
  'DRAFT',
  'CONFIRMED',
  'WAITING_FOR_PAYMENT',
  'WAITING_FOR_MATERIALS',
  'READY_FOR_PRODUCTION',
  'ON_HOLD',
]);
const IN_PRODUCTION = new Set(['IN_PRODUCTION']);
const DONE = new Set(['READY_FOR_DELIVERY', 'DELIVERED', 'COMPLETED']);
const ACTIVE_PRODUCTION_PO = new Set([
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
]);

function isInProductionOrder(o: {
  status: string;
  progressPercent?: number | null;
  productionOrders?: Array<{ status: string }>;
}) {
  if (DONE.has(o.status)) return false;
  if (IN_PRODUCTION.has(o.status)) return true;
  if (o.progressPercent != null && o.progressPercent > 0) return true;
  return (o.productionOrders ?? []).some((po) => ACTIVE_PRODUCTION_PO.has(po.status));
}

function money(value: unknown, currency: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(2)} ${currency}`;
}

function OrderBox({
  href,
  number,
  dealerNumber,
  title,
  status,
  imageUrl,
  progress,
  sellerPrice,
  productionPrice,
  subtitle,
  currency,
  tSales,
  tCommon,
}: {
  href: string;
  number: string;
  dealerNumber?: string | null;
  title: string;
  status: string;
  imageUrl?: string | null;
  progress?: number | null;
  sellerPrice?: unknown;
  productionPrice?: unknown;
  subtitle?: string | null;
  currency: string;
  tSales: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
}) {
  const seller = Number(sellerPrice);
  const production = Number(productionPrice);
  const hasSeller = Number.isFinite(seller);
  const hasProduction = Number.isFinite(production);
  const pct = progress != null ? Math.min(100, Math.max(0, Number(progress))) : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-brand/40 hover:shadow-sm">
      <Link
        href={href}
        className="relative block aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-tertiary">
            <Armchair className="h-7 w-7 opacity-40" />
            <span className="text-[10px] font-medium uppercase tracking-wide" dir="ltr">
              {number}
            </span>
          </div>
        )}
        <div className="absolute start-1.5 top-1.5 origin-top-start scale-90">
          <StatusBadge status={status} />
        </div>
        {pct != null ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-5">
            <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] font-medium text-white">
              <span>{tSales('progress')}</span>
              <span dir="ltr">{pct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white" dir="ltr">
                {pct}%
              </span>
            </div>
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary" dir="ltr">
            <span className="font-medium normal-case tracking-normal">{tSales('systemOrderNumber')}: </span>
            {number}
          </p>
          {dealerNumber ? (
            <p className="truncate text-[11px] text-text-secondary" dir="ltr">
              <span className="text-text-tertiary">{tSales('dealerOrderNumber')}: </span>
              {dealerNumber}
            </p>
          ) : null}
        </div>
        <Link
          href={href}
          className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary hover:text-brand"
        >
          {title}
        </Link>
        {subtitle ? <p className="truncate text-[11px] text-text-tertiary">{subtitle}</p> : null}

        <div className="mt-auto space-y-0.5 maher-card-rule-t pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] text-text-tertiary">{tSales('sellerPrice')}</span>
            <span className="text-sm font-bold tracking-tight text-text-primary" dir="ltr">
              {hasSeller ? money(seller, currency) : '—'}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] text-text-tertiary">{tSales('productionPrice')}</span>
            <span className="text-xs font-semibold text-text-secondary" dir="ltr">
              {hasProduction ? money(production, currency) : '—'}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

interface DealerSectionsProps {
  customerId: string;
}

export function DealerSections({ customerId }: DealerSectionsProps) {
  const locale = useLocale();
  const t = useTranslations('customers');
  const tc = useTranslations('catalog');
  const tNav = useTranslations('navigation');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const currency = tCommon('currency');

  const [tab, setTab] = useState<DealerTab>('orders');
  const [page, setPage] = useState(1);
  const [priceOpen, setPriceOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const gridKind: GridFitKind =
    tab === 'orders' || tab === 'production' || tab === 'completed' || tab === 'priceList'
      ? 'order'
      : 'list';
  const { hostRef, cols, pageSize } = useGridFit(gridKind, tab);

  function switchTab(next: DealerTab) {
    setTab(next);
    setPage(1);
  }

  const ordersQuery = useQuery({
    queryKey: ['dealer-orders', customerId],
    queryFn: () =>
      apiFetch<{ data: SalesOrderRow[] }>(
        `/api/v1/sales-orders?customerId=${customerId}&pageSize=100`,
      ).then((r) => r.data),
    enabled: tab === 'orders' || tab === 'completed' || tab === 'production',
  });

  const productionQuery = useQuery({
    queryKey: ['dealer-production', customerId],
    queryFn: () =>
      apiFetch<{ data: ProductionRow[] }>(
        `/api/v1/production-orders?customerId=${customerId}&pageSize=50`,
      ).then((r) => r.data),
    enabled: tab === 'production',
  });

  const invoicesQuery = useQuery({
    queryKey: ['dealer-invoices', customerId],
    queryFn: () =>
      apiFetch<{ data: InvoiceRow[] }>(
        `/api/v1/invoices?customerId=${customerId}&pageSize=50`,
      ).then((r) => r.data),
    enabled: tab === 'invoices',
  });

  const paymentsQuery = useQuery({
    queryKey: ['dealer-payments', customerId],
    queryFn: () =>
      apiFetch<{ data: PaymentRow[] }>(
        `/api/v1/payments?customerId=${customerId}&pageSize=50`,
      ).then((r) => r.data),
    enabled: tab === 'payments',
  });

  const pricesQuery = useQuery({
    queryKey: ['dealer-prices', customerId],
    queryFn: () =>
      apiFetch<DealerPriceRow[]>(`/api/v1/customers/${customerId}/dealer-prices`),
    enabled: tab === 'priceList',
  });

  const productsQuery = useQuery({
    queryKey: ['products-pick'],
    queryFn: () =>
      apiFetch<{ data: CatalogProduct[] }>('/api/v1/products?pageSize=100&isActive=true').then(
        (r) => r.data,
      ),
    enabled: tab === 'priceList' || priceOpen,
  });

  const statementQuery = useQuery({
    queryKey: ['dealer-statement', customerId],
    queryFn: () =>
      apiFetch<{
        closingBalance: number | string;
        entries: Array<{
          date: string;
          description: string;
          debit: string | number;
          credit: string | number;
          balance: number;
        }>;
      }>(`/api/v1/statements/${customerId}`),
    enabled: tab === 'soa',
  });

  const savePriceMutation = useMutation({
    mutationFn: async () => {
      if (!productId || !price || Number(price) < 0) {
        throw new Error(t('dealerPriceRequired'));
      }
      if (editingId) {
        return apiFetch(`/api/v1/customers/${customerId}/dealer-prices/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ price: Number(price) }),
        });
      }
      return apiFetch(`/api/v1/customers/${customerId}/dealer-prices`, {
        method: 'POST',
        body: JSON.stringify({ productId, price: Number(price) }),
      });
    },
    onSuccess: async () => {
      setPriceOpen(false);
      setEditingId(null);
      setProductId('');
      setPrice('');
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['dealer-prices', customerId] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const deletePriceMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/customers/${customerId}/dealer-prices/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dealer-prices', customerId] });
    },
  });

  const salesOrders = ordersQuery.data ?? [];
  const waitingOrders = useMemo(
    () => salesOrders.filter((o) => WAITING.has(o.status) && !isInProductionOrder(o)),
    [salesOrders],
  );
  const productionSales = useMemo(
    () => salesOrders.filter((o) => isInProductionOrder(o)),
    [salesOrders],
  );
  const completedOrders = useMemo(
    () => salesOrders.filter((o) => DONE.has(o.status)),
    [salesOrders],
  );
  const activeProductionOrders = useMemo(
    () =>
      (productionQuery.data ?? []).filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)),
    [productionQuery.data],
  );
  const statementEntries = statementQuery.data?.entries ?? [];
  const payments = paymentsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const prices = pricesQuery.data ?? [];

  const waitingPage = pageSlice(waitingOrders, page, pageSize);
  const completedPage = pageSlice(completedOrders, page, pageSize);
  const productionSalesPage = pageSlice(productionSales, page, pageSize);
  const productionPoPage = pageSlice(activeProductionOrders, page, pageSize);
  const statementPage = pageSlice(statementEntries, page, pageSize);
  const paymentsPage = pageSlice(payments, page, pageSize);
  const invoicesPage = pageSlice(invoices, page, pageSize);
  const pricesPage = pageSlice(prices, page, pageSize);

  const orderGridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  } as const;
  const listGridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  } as const;

  const tabs: Array<{ key: DealerTab; label: string; count?: number }> = [
    { key: 'orders', label: tNav('orders'), count: waitingOrders.length },
    {
      key: 'production',
      label: t('inProduction'),
      count: Math.max(productionSales.length, activeProductionOrders.length),
    },
    { key: 'completed', label: t('completedOrders'), count: completedOrders.length },
    { key: 'soa', label: tNav('statement'), count: statementEntries.length || undefined },
    { key: 'payments', label: tNav('payments'), count: payments.length || undefined },
    { key: 'invoices', label: tNav('invoices'), count: invoices.length || undefined },
    { key: 'priceList', label: t('priceList'), count: prices.length || undefined },
  ];

  const loading =
    ((tab === 'orders' || tab === 'completed') && ordersQuery.isLoading) ||
    (tab === 'production' && (ordersQuery.isLoading || productionQuery.isLoading)) ||
    (tab === 'invoices' && invoicesQuery.isLoading) ||
    (tab === 'payments' && paymentsQuery.isLoading) ||
    (tab === 'priceList' && pricesQuery.isLoading) ||
    (tab === 'soa' && statementQuery.isLoading);

  const products = productsQuery.data ?? [];
  const pricedProductIds = new Set(
    (pricesQuery.data ?? []).map((r) => r.product?.id ?? r.productId).filter(Boolean),
  );

  function orderTitle(row: SalesOrderRow) {
    return row.title?.trim() || row.number;
  }

  function endCustomer(row: SalesOrderRow) {
    return row.quotation?.request?.endCustomerName ?? null;
  }

  function dealerNo(row: SalesOrderRow) {
    return (
      row.externalOrderNumber?.trim() ||
      row.quotation?.request?.externalOrderNumber?.trim() ||
      null
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const selected = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => switchTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                selected
                  ? 'border-brand bg-[var(--maher-brand-soft)] text-brand'
                  : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
              }`}
            >
              <span>{item.label}</span>
              {item.count != null ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    selected ? 'bg-surface/70 text-inherit' : 'bg-[var(--maher-surface-muted)]'
                  }`}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div ref={hostRef} className="w-full">
      {loading ? (
        <div className="grid gap-3" style={gridKind === 'order' ? orderGridStyle : listGridStyle}>
          {Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {!loading && tab === 'orders' ? (
        waitingOrders.length === 0 ? (
          <EmptyState title={t('noOrders')} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3" style={orderGridStyle}>
              {waitingPage.items.map((row) => (
                <OrderBox
                  key={row.id}
                  href={`/sales-orders/${row.id}`}
                  number={row.number}
                  dealerNumber={dealerNo(row)}
                  title={orderTitle(row)}
                  status={row.status}
                  imageUrl={row.imageUrl}
                  progress={row.progressPercent}
                  sellerPrice={row.sellerPrice ?? row.total}
                  productionPrice={row.productionPrice ?? row.manufacturingCost}
                  subtitle={endCustomer(row)}
                  currency={currency}
                  tSales={tSales}
                  tCommon={tCommon}
                />
              ))}
            </div>
            <SummaryPager
              page={waitingPage.page}
              totalPages={waitingPage.totalPages}
              onChange={setPage}
              previousLabel={tCommon('previous')}
              nextLabel={tCommon('next')}
            />
          </div>
        )
      ) : null}

      {!loading && tab === 'completed' ? (
        completedOrders.length === 0 ? (
          <EmptyState title={t('noCompletedOrders')} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3" style={orderGridStyle}>
              {completedPage.items.map((row) => (
                <OrderBox
                  key={row.id}
                  href={`/sales-orders/${row.id}`}
                  number={row.number}
                  dealerNumber={dealerNo(row)}
                  title={orderTitle(row)}
                  status={row.status}
                  imageUrl={row.imageUrl}
                  progress={row.progressPercent ?? 100}
                  sellerPrice={row.sellerPrice ?? row.total}
                  productionPrice={row.productionPrice ?? row.manufacturingCost}
                  subtitle={endCustomer(row)}
                  currency={currency}
                  tSales={tSales}
                  tCommon={tCommon}
                />
              ))}
            </div>
            <SummaryPager
              page={completedPage.page}
              totalPages={completedPage.totalPages}
              onChange={setPage}
              previousLabel={tCommon('previous')}
              nextLabel={tCommon('next')}
            />
          </div>
        )
      ) : null}

      {!loading && tab === 'production' ? (
        productionSales.length === 0 && activeProductionOrders.length === 0 ? (
          <EmptyState title={t('noProduction')} />
        ) : productionSales.length > 0 ? (
          <div className="space-y-3">
            <div className="grid gap-3" style={orderGridStyle}>
              {productionSalesPage.items.map((row) => (
                <OrderBox
                  key={row.id}
                  href={`/sales-orders/${row.id}`}
                  number={row.number}
                  dealerNumber={dealerNo(row)}
                  title={orderTitle(row)}
                  status={row.status}
                  imageUrl={row.imageUrl}
                  progress={row.progressPercent ?? 0}
                  sellerPrice={row.sellerPrice ?? row.total}
                  productionPrice={row.productionPrice ?? row.manufacturingCost}
                  subtitle={endCustomer(row)}
                  currency={currency}
                  tSales={tSales}
                  tCommon={tCommon}
                />
              ))}
            </div>
            <SummaryPager
              page={productionSalesPage.page}
              totalPages={productionSalesPage.totalPages}
              onChange={setPage}
              previousLabel={tCommon('previous')}
              nextLabel={tCommon('next')}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3" style={orderGridStyle}>
              {productionPoPage.items.map((row) => (
                <OrderBox
                  key={row.id}
                  href={
                    row.salesOrder?.id
                      ? `/sales-orders/${row.salesOrder.id}`
                      : `/production/${row.id}`
                  }
                  number={row.salesOrder?.number ?? row.number}
                  dealerNumber={row.salesOrder?.externalOrderNumber}
                  title={row.productDescription || row.number}
                  status={row.status}
                  progress={row.progressPercent ?? 0}
                  subtitle={row.number !== row.salesOrder?.number ? row.number : null}
                  currency={currency}
                  tSales={tSales}
                  tCommon={tCommon}
                />
              ))}
            </div>
            <SummaryPager
              page={productionPoPage.page}
              totalPages={productionPoPage.totalPages}
              onChange={setPage}
              previousLabel={tCommon('previous')}
              nextLabel={tCommon('next')}
            />
          </div>
        )
      ) : null}

      {!loading && tab === 'soa' && statementQuery.data ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
            <div>
              <p className="text-[11px] text-text-tertiary">{t('balance')}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight" dir="ltr">
                {money(statementQuery.data.closingBalance, currency)}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                window.open(`${API_URL}/api/v1/statements/${customerId}/pdf`, '_blank')
              }
            >
              {tCommon('download')}
            </Button>
          </div>
          {statementEntries.length === 0 ? (
            <EmptyState title={tNav('statement')} />
          ) : (
            <>
              <div className="grid gap-3" style={listGridStyle}>
                {statementPage.items.map((line, i) => (
                  <div
                    key={`${line.date}-${i}`}
                    className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-text-tertiary">
                        <FileText className="h-4 w-4" />
                        <span className="text-xs" dir="ltr">
                          {line.date.slice(0, 10)}
                        </span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums" dir="ltr">
                        {money(line.balance, currency)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-text-primary">{line.description}</p>
                    <div className="mt-3 flex justify-between gap-3 text-xs text-text-secondary">
                      <span dir="ltr">
                        {tCommon('debit')}: {money(line.debit, currency)}
                      </span>
                      <span dir="ltr">
                        {tCommon('credit')}: {money(line.credit, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <SummaryPager
                page={statementPage.page}
                totalPages={statementPage.totalPages}
                onChange={setPage}
                previousLabel={tCommon('previous')}
                nextLabel={tCommon('next')}
              />
            </>
          )}
        </div>
      ) : null}

      {!loading && tab === 'payments' ? (
        payments.length === 0 ? (
          <EmptyState title={t('noPayments')} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3" style={listGridStyle}>
              {paymentsPage.items.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-text-tertiary" />
                      <p className="text-sm font-semibold" dir="ltr">
                        {row.number}
                      </p>
                    </div>
                    <p className="text-base font-bold tabular-nums tracking-tight" dir="ltr">
                      {money(row.amount, currency)}
                    </p>
                  </div>
                  <div className="mt-3 flex justify-between gap-2 text-xs text-text-secondary">
                    <span>{row.method ?? '—'}</span>
                    <span dir="ltr">{row.paymentDate?.slice(0, 10) ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
            <SummaryPager
              page={paymentsPage.page}
              totalPages={paymentsPage.totalPages}
              onChange={setPage}
              previousLabel={tCommon('previous')}
              nextLabel={tCommon('next')}
            />
          </div>
        )
      ) : null}

      {!loading && tab === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState title={t('noInvoices')} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3" style={listGridStyle}>
              {invoicesPage.items.map((row) => (
                <Link
                  key={row.id}
                  href={`/invoices/${row.id}`}
                  className="rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-text-tertiary" />
                      <p className="text-sm font-semibold" dir="ltr">
                        {row.number}
                      </p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  {row.salesOrder?.number ? (
                    <p className="mt-2 text-[11px] text-text-secondary" dir="ltr">
                      {tSales('systemOrderNumber')}: {row.salesOrder.number}
                      {row.salesOrder.externalOrderNumber
                        ? ` · ${tSales('dealerOrderNumber')}: ${row.salesOrder.externalOrderNumber}`
                        : ''}
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="text-text-tertiary">{tCommon('total')}</span>
                      <span className="font-semibold tabular-nums" dir="ltr">
                        {money(row.total, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="text-text-tertiary">{tCommon('outstanding')}</span>
                      <span className="font-medium tabular-nums text-text-secondary" dir="ltr">
                        {money(row.outstandingAmount, currency)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <SummaryPager
              page={invoicesPage.page}
              totalPages={invoicesPage.totalPages}
              onChange={setPage}
              previousLabel={tCommon('previous')}
              nextLabel={tCommon('next')}
            />
          </div>
        )
      ) : null}

      {!loading && tab === 'priceList' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-secondary">{t('priceListHint')}</p>
            <Button
              size="sm"
              onClick={() => {
                setEditingId(null);
                setProductId('');
                setPrice('');
                setFormError(null);
                setPriceOpen(true);
              }}
            >
              {t('addPrice')}
            </Button>
          </div>
          {prices.length === 0 ? (
            <EmptyState title={t('noPrices')} description={t('priceListHint')} />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3" style={orderGridStyle}>
                {pricesPage.items.map((row) => {
                  const productName = row.product
                    ? localizedName(locale, row.product, row.product.nameEn)
                    : '—';
                  const imageUrl = row.product?.imageUrl?.trim() || null;
                  return (
                    <article
                      key={row.id}
                      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-brand/40 hover:shadow-sm"
                    >
                      <div className="relative aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt={productName}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-tertiary">
                            <Armchair className="h-7 w-7 opacity-40" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">
                          {productName}
                        </p>
                        <div className="mt-auto space-y-0.5 maher-card-rule-t pt-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[10px] text-text-tertiary">{t('dealerPrice')}</span>
                            <span
                              className="text-sm font-bold tracking-tight text-text-primary tabular-nums"
                              dir="ltr"
                            >
                              {money(row.price, row.currency || currency)}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[10px] text-text-tertiary">
                              {tSales('productionPrice')}
                            </span>
                            <span className="text-xs font-semibold text-text-secondary" dir="ltr">
                              {money(row.product?.manufacturingCost, currency)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(row.id);
                              setProductId(row.product?.id ?? row.productId ?? '');
                              setPrice(String(row.price));
                              setFormError(null);
                              setPriceOpen(true);
                            }}
                          >
                            {tCommon('edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={deletePriceMutation.isPending}
                            onClick={() => deletePriceMutation.mutate(row.id)}
                          >
                            {tCommon('delete')}
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <SummaryPager
                page={pricesPage.page}
                totalPages={pricesPage.totalPages}
                onChange={setPage}
                previousLabel={tCommon('previous')}
                nextLabel={tCommon('next')}
              />
            </div>
          )}
        </div>
      ) : null}
      </div>

      <Modal
        open={priceOpen}
        onClose={() => !savePriceMutation.isPending && setPriceOpen(false)}
        title={editingId ? tCommon('edit') : t('addPrice')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPriceOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={savePriceMutation.isPending} onClick={() => savePriceMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <p className="text-xs text-text-tertiary">{t('priceListHint')}</p>
          <Select
            label={tc('product')}
            value={productId}
            disabled={Boolean(editingId)}
            onChange={(e) => {
              const next = e.target.value;
              setProductId(next);
              const product = products.find((p) => p.id === next);
              if (product?.basePrice != null && !price) {
                setPrice(String(product.basePrice));
              }
            }}
            options={[
              { value: '', label: tc('select') },
              ...products
                .filter((p) => editingId || !pricedProductIds.has(p.id) || p.id === productId)
                .map((p) => ({
                  value: p.id,
                  label: localizedName(locale, p),
                })),
            ]}
          />
          <Input
            label={t('dealerPrice')}
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            dir="ltr"
          />
        </div>
      </Modal>
    </div>
  );
}
