'use client';

import { salesOrderTone, useOrdersCopy, type SalesOrderRow } from '@/components/orders/orders-shared';
import type { ReturnRow } from '@/components/returns/return-types';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import type { Paginated } from '@/lib/paginated';
import { localizedName } from '@maher/i18n';
import {
  Alert,
  Board,
  BoardSkeleton,
  Button,
  Checkbox,
  Combobox,
  ConfirmDialog,
  DataBoard,
  DetailHero,
  ErrorBoard,
  Figure,
  Input,
  KeyFacts,
  Ledger,
  LedgerRow,
  Ltr,
  Menu,
  Meter,
  MoneyField,
  SectionTabs,
  Sheet,
  Sparkline,
  Stamp,
  TextArea,
  Timeline,
  useToast,
  type BoardTone,
  type DataColumn,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, MapPin, MoreHorizontal, Pencil, Phone, Plus, Printer, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DealerFormFields, dealerFormFromRow, dealerUpdatePayload, statusTone, useDealerCopy, validateDealerForm, type CustomerRow, type DealerForm } from './dealers-shared';

interface CustomerDetail extends CustomerRow {
  contacts?: Array<{ id: string; name: string; phone?: string | null; email?: string | null; position?: string | null; isPrimary?: boolean }>;
  addresses?: Array<{ id: string; label: string; city: string; street?: string | null; country: string; isDefaultDelivery: boolean; isDefaultBilling: boolean }>;
}
interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  total: unknown;
  outstandingAmount: unknown;
  issueDate?: string | null;
  dueDate?: string | null;
  salesOrder?: { id: string; number: string } | null;
}
interface PaymentRow {
  id: string;
  number: string;
  amount: unknown;
  method?: string;
  paymentDate?: string;
  createdAt?: string;
  allocations?: Array<{ amount: unknown; invoice?: { number: string } | null }>;
}
interface DealerPriceRow {
  id: string;
  price: unknown;
  currency: string;
  productId?: string;
  product?: { id?: string; sku: string; nameEn: string; nameAr?: string; nameHe?: string; basePrice?: unknown; imageUrl?: string | null };
}
interface CatalogProduct {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string;
  nameHe?: string;
  basePrice?: string | number | null;
}
interface ActivityRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  userId?: string | null;
  newValues?: Record<string, unknown> | null;
}
interface CommunicationNote {
  id: string;
  type: string;
  summary: string;
  subject?: string | null;
  occurredAt?: string;
  createdAt?: string;
  employee?: { firstName?: string | null; lastName?: string | null } | null;
}

const TABS = ['orders', 'invoices', 'payments', 'returns', 'prices', 'activity'] as const;
type Tab = (typeof TABS)[number];

function invoiceTone(status: string, outstanding: number, dueDate?: string | null): BoardTone {
  if (status === 'PAID') return 'success';
  if (status === 'CANCELLED' || status === 'VOID') return 'neutral';
  if (dueDate && new Date(dueDate).getTime() < Date.now() && outstanding > 0) return 'error';
  if (status === 'PARTIALLY_PAID') return 'warning';
  return 'info';
}

export function DealerDossier({ id }: { id: string }) {
  const copy = useDealerCopy();
  const oc = useOrdersCopy();
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tAccounting = useTranslations('accounting');
  const tSales = useTranslations('sales');
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const search = useSearchParams();
  const { openPdf, pdfDialog } = usePdfDownload();
  const tab: Tab = (TABS as readonly string[]).includes(search.get('tab') ?? '') ? (search.get('tab') as Tab) : 'orders';
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    if (next === 'orders') sp.delete('tab');
    else sp.set('tab', next);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<DealerForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ portalUsername: '', portalPassword: '' });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const customer = useQuery({ queryKey: ['customer', id], queryFn: () => apiFetch<CustomerDetail>(`/api/v1/customers/${id}`) });
  const finance = useQuery({ queryKey: ['dealer-finance', id], queryFn: () => apiFetch<{ amountDue: number; availableCredit: number; currency?: string }>(`/api/v1/payments/dealer/${id}/summary`) });
  const payments = useQuery({ queryKey: ['dealer-payments', id], queryFn: () => apiFetch<Paginated<PaymentRow>>(`/api/v1/payments?customerId=${id}&pageSize=100`).then((r) => r.data) });
  const invoices = useQuery({ queryKey: ['dealer-invoices', id], queryFn: () => apiFetch<Paginated<InvoiceRow>>(`/api/v1/invoices?customerId=${id}&pageSize=100`).then((r) => r.data) });
  const orders = useQuery({ queryKey: ['dealer-orders', id], queryFn: () => apiFetch<Paginated<SalesOrderRow>>(`/api/v1/sales-orders?customerId=${id}&pageSize=100`).then((r) => r.data) });
  const returns = useQuery({ queryKey: ['dealer-returns', id], queryFn: () => apiFetch<Paginated<ReturnRow>>(`/api/v1/returns?customerId=${id}&pageSize=50`).then((r) => r.data), enabled: tab === 'returns' });
  const prices = useQuery({ queryKey: ['dealer-prices', id], queryFn: () => apiFetch<DealerPriceRow[]>(`/api/v1/customers/${id}/dealer-prices`), enabled: tab === 'prices' });
  const activity = useQuery({ queryKey: ['dealer-activity', id], queryFn: () => apiFetch<ActivityRow[]>(`/api/v1/customers/${id}/activity`), enabled: tab === 'activity' });
  const notes = useQuery({ queryKey: ['customer-notes', id], queryFn: () => apiFetch<CommunicationNote[]>(`/api/v1/customers/${id}/communications`) });

  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: ['customer', id] }), qc.invalidateQueries({ queryKey: ['customers'] }), qc.invalidateQueries({ queryKey: ['customers-pulse'] })]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editForm) return;
      validateDealerForm(editForm, t, 'edit');
      return apiFetch(`/api/v1/customers/${id}`, { method: 'PATCH', body: JSON.stringify(dealerUpdatePayload(editForm)) });
    },
    onSuccess: async () => {
      setEditOpen(false);
      setEditError(null);
      toast.success(t('updated'));
      await invalidate();
    },
    onError: (err) => setEditError(mutationErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (deleteForm.portalUsername.trim().length < 2 || !deleteForm.portalPassword) throw new ApiClientError(t('deleteDealerBadCredentials'), 400);
      return apiFetch(`/api/v1/customers/${id}`, { method: 'DELETE', body: JSON.stringify({ portalUsername: deleteForm.portalUsername.trim().toLowerCase(), portalPassword: deleteForm.portalPassword }) });
    },
    onSuccess: async () => {
      toast.success(t('deleted'));
      await qc.invalidateQueries({ queryKey: ['customers'] });
      router.push(`/${copy.locale}/admin/customers`);
    },
    onError: (err) => setDeleteError(mutationErrorMessage(err)),
  });

  // 30-day payment sparkline + last payment.
  const paymentSeries = useMemo(() => {
    const list = payments.data ?? [];
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (29 - i));
      return d.getTime();
    });
    const buckets = new Array(30).fill(0) as number[];
    let last: PaymentRow | null = null;
    let total30 = 0;
    for (const p of list) {
      const when = new Date(p.paymentDate ?? p.createdAt ?? 0).getTime();
      if (!last || when > new Date(last.paymentDate ?? last.createdAt ?? 0).getTime()) last = p;
      const idx = days.findIndex((d, i) => when >= d && (i === 29 || when < (days[i + 1] ?? Infinity)));
      if (idx >= 0) {
        buckets[idx] = (buckets[idx] ?? 0) + Number(p.amount ?? 0);
        total30 += Number(p.amount ?? 0);
      }
    }
    return { buckets, last, total30 };
  }, [payments.data]);

  if (customer.isLoading) return <BoardSkeleton rows={6} />;
  if (customer.isError || !customer.data) return <ErrorBoard title={t('detail')} description={mutationErrorMessage(customer.error)} onRetry={() => customer.refetch()} />;
  const c = customer.data;
  const name = localizedName(copy.locale, c, c.name);
  const due = Number(finance.data?.amountDue ?? c.outstandingTotal ?? 0);
  const credit = Number(finance.data?.availableCredit ?? c.availableCredit ?? 0);
  const invoiced = Number(c.invoicedTotal ?? 0);
  const paid = Number(c.paidTotal ?? 0);
  const openInvoices = (invoices.data ?? []).filter((i) => Number(i.outstandingAmount ?? 0) > 0);
  const overdueInvoices = openInvoices.filter((i) => i.dueDate && new Date(i.dueDate).getTime() < Date.now());
  const moneyTone: BoardTone = overdueInvoices.length ? 'error' : due > 0 ? 'warning' : 'success';
  const activeOrders = (orders.data ?? []).filter((o) => !['DELIVERED', 'CANCELLED', 'CLOSED'].includes(o.status));

  const tabs = [
    { id: 'orders', label: tNav('orders'), count: activeOrders.length },
    { id: 'invoices', label: tNav('invoices'), count: openInvoices.length, tone: overdueInvoices.length ? ('error' as const) : undefined },
    { id: 'payments', label: tNav('payments'), count: payments.data?.length ?? null },
    { id: 'returns', label: t('returns') },
    { id: 'prices', label: t('priceList') },
    { id: 'activity', label: t('activity') },
  ];

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        back={{ label: t('title'), href: '/admin/customers' }}
        LinkComponent={Link}
        code={c.code}
        title={name}
        subtitle={[copy.typeLabel(c.customerType), c.companyName, c.phone].filter(Boolean).join(' · ')}
        status={{ label: copy.statusLabel(c.status ?? 'ACTIVE'), tone: statusTone(c.status) }}
        media={<span className="flex h-20 w-20 items-center justify-center rounded-[14px] bg-[var(--maher-brand-soft)] text-[22px] font-semibold text-[var(--maher-brand)] sm:h-24 sm:w-24">{initials(name)}</span>}
        facts={[
          { label: t('activeOrders'), value: String(c.activeOrdersCount ?? 0), ltr: true },
          { label: t('ordersInWork'), value: String(c.inWorkOrdersCount ?? 0), ltr: true },
          { label: tAccounting('amountDue'), value: copy.money(due), ltr: true, tone: due > 0 ? moneyTone : undefined },
          { label: tAccounting('accountCredit'), value: copy.money(credit), ltr: true, tone: credit > 0 ? 'success' : undefined },
          { label: t('dealerSince'), value: copy.date(c.createdAt, { month: 'short', year: 'numeric' }), ltr: true },
        ]}
        primary={
          <Button leadingIcon={<FileText className="h-4 w-4" />} onClick={() => openPdf({ path: `/api/v1/statements/${id}/pdf`, documentName: `${tNav('statement')} · ${name}`, filename: `${c.code}-statement.pdf`, withRange: true })}>
            {t('statementPdf')}
          </Button>
        }
        actions={
          <>
            <Button variant="secondary" leadingIcon={<Pencil className="h-4 w-4" />} onClick={() => (setEditForm(dealerFormFromRow(c)), setEditError(null), setEditOpen(true))}>
              {tCommon('edit')}
            </Button>
            <Menu
              aria-label={tCommon('more')}
              trigger={<Button variant="secondary" aria-label={tCommon('more')}><MoreHorizontal className="h-4 w-4" /></Button>}
              items={[
                { id: 'orders', label: tNav('orders'), href: `/admin/sales-orders?customerId=${id}` },
                { id: 'invoices', label: tNav('invoices'), href: `/admin/invoices?customerId=${id}` },
                { id: 'delete', label: t('deleteDealer'), icon: <Trash2 className="h-4 w-4" />, tone: 'error', separator: true, onSelect: () => (setDeleteForm({ portalUsername: '', portalPassword: '' }), setDeleteError(null), setDeleteOpen(true)) },
              ]}
              LinkComponent={Link}
            />
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-12">
        {/* Money board */}
        <Board tone={moneyTone} wash="top" className="xl:col-span-5">
          <Board.Header title={t('money')} meta={overdueInvoices.length ? <Stamp tone="error" size="sm">{tSales('desk.overdueCount', { count: overdueInvoices.length })}</Stamp> : null} />
          <Board.Body className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Figure value={copy.money(due)} label={tAccounting('amountDue')} tone={due > 0 ? moneyTone : 'success'} locale={copy.locale} />
              <Figure value={copy.money(credit)} label={tAccounting('accountCredit')} tone={credit > 0 ? 'success' : 'neutral'} size="md" locale={copy.locale} />
            </div>
            {invoiced > 0 ? <Meter value={Math.min(due, invoiced)} max={invoiced} label={t('overdueShare')} valueLabel={`${Math.round((due / invoiced) * 100)}%`} tone={moneyTone} /> : null}
            <Ledger>
              <LedgerRow label={tSales('desk.invoiced')} value={copy.money(invoiced)} hint={t('invoiceCount', { count: invoices.data?.length ?? 0 })} />
              <LedgerRow label={t('amountPaid')} value={copy.money(paid)} tone="success" stamp />
              <LedgerRow label={t('openInvoices')} value={String(openInvoices.length)} tone={openInvoices.length ? 'warning' : 'neutral'} stamp={openInvoices.length > 0} href={`?tab=invoices`} LinkComponent={Link} />
            </Ledger>
            <div className="rounded-[12px] border border-[var(--maher-border)] px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] text-[var(--maher-text-tertiary)]">{t('paymentsLast30')}</span>
                <Ltr className="text-[14px] font-semibold text-[var(--maher-text-primary)]">{copy.money(paymentSeries.total30)}</Ltr>
              </div>
              <Sparkline points={paymentSeries.buckets} tone="success" height={44} area endDot className="mt-2 w-full" />
              <p className="mt-1 text-[12px] text-[var(--maher-text-tertiary)]">
                {t('lastPayment')}: {paymentSeries.last ? `${copy.money(paymentSeries.last.amount)} · ${copy.date(paymentSeries.last.paymentDate ?? paymentSeries.last.createdAt)}` : t('noPaymentYet')}
              </p>
            </div>
          </Board.Body>
        </Board>

        {/* Contact card */}
        <Board tone="neutral" className="xl:col-span-4">
          <Board.Header title={t('detail')} />
          <Board.Body>
            <KeyFacts
              columns={2}
              facts={[
                { label: t('phone'), value: c.phone ?? '—', ltr: true },
                { label: t('fax'), value: c.fax ?? '—', ltr: true },
                { label: t('email'), value: c.email ?? '—', ltr: true, wide: true },
                { label: t('type'), value: copy.typeLabel(c.customerType) },
                { label: t('portalLanguage'), value: c.preferredLanguage === 'ar' ? 'العربية' : c.preferredLanguage === 'he' ? 'עברית' : 'English' },
                ...(c.notes ? [{ label: t('profileNotes'), value: c.notes, wide: true, muted: true }] : []),
              ]}
            />
          </Board.Body>
        </Board>

        {/* Contacts + addresses */}
        <div className="space-y-5 xl:col-span-3">
          <ContactsBoard customer={c} onChanged={invalidate} />
          <AddressesBoard customer={c} onChanged={invalidate} />
        </div>
      </div>

      <Board tone="brand">
        <Board.Header title={t('dealerSummary')} plain>
          <SectionTabs items={tabs} value={tab} onChange={setTab} size="sm" aria-label={t('dealerSummary')} fill />
        </Board.Header>
        {tab === 'orders' ? <OrdersTab rows={orders.data ?? []} loading={orders.isLoading} /> : null}
        {tab === 'invoices' ? <InvoicesTab rows={invoices.data ?? []} loading={invoices.isLoading} openPdf={openPdf} /> : null}
        {tab === 'payments' ? <PaymentsTab rows={payments.data ?? []} loading={payments.isLoading} openPdf={openPdf} /> : null}
        {tab === 'returns' ? <ReturnsTab rows={returns.data ?? []} loading={returns.isLoading} /> : null}
        {tab === 'prices' ? <PricesTab customerId={id} rows={prices.data ?? []} loading={prices.isLoading} /> : null}
        {tab === 'activity' ? <ActivityTab rows={activity.data ?? []} loading={activity.isLoading} /> : null}
      </Board>

      <NotesBoard customerId={id} notes={notes.data ?? []} loading={notes.isLoading} onChanged={() => qc.invalidateQueries({ queryKey: ['customer-notes', id] })} />

      <Sheet
        open={editOpen}
        onClose={() => !save.isPending && setEditOpen(false)}
        title={t('edit')}
        widthClassName="max-w-xl"
        footer={
          <>
            <Button variant="ghost" disabled={save.isPending} onClick={() => setEditOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        {editForm ? <DealerFormFields form={editForm} setForm={setEditForm} mode="edit" error={editError} /> : null}
      </Sheet>

      <Sheet
        open={deleteOpen}
        onClose={() => !remove.isPending && setDeleteOpen(false)}
        title={t('deleteDealer')}
        description={t('deleteDealerHint')}
        tone="error"
        footer={
          <>
            <Button variant="ghost" disabled={remove.isPending} onClick={() => setDeleteOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              {t('deleteDealerConfirm')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {deleteError ? <Alert variant="error">{deleteError}</Alert> : null}
          <Input label={t('portalUsername')} value={deleteForm.portalUsername} onChange={(e) => setDeleteForm({ ...deleteForm, portalUsername: e.target.value })} autoComplete="off" dir="ltr" />
          <Input label={t('portalPassword')} type="password" value={deleteForm.portalPassword} onChange={(e) => setDeleteForm({ ...deleteForm, portalPassword: e.target.value })} autoComplete="off" dir="ltr" />
        </div>
      </Sheet>

      {pdfDialog}
    </div>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '·';
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

function OrdersTab({ rows, loading }: { rows: SalesOrderRow[]; loading: boolean }) {
  const oc = useOrdersCopy();
  const t = useTranslations('customers');
  const tSales = useTranslations('sales');
  const columns: DataColumn<SalesOrderRow>[] = [
    {
      key: 'number',
      header: oc.tm('columns.number' as never),
      cell: (o) => (
        <span className="min-w-0">
          <Ltr className="block font-semibold text-[var(--maher-text-primary)]">{o.number}</Ltr>
          <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">{o.title ?? o.externalOrderNumber ?? ''}</span>
        </span>
      ),
    },
    { key: 'status', header: oc.tCommon('status'), cell: (o) => <Stamp tone={salesOrderTone(o.status)} size="sm">{oc.status(o.status)}</Stamp> },
    { key: 'due', header: tSales('desk.deliveryDate'), hideBelow: 'md', cell: (o) => oc.date(o.requiredDeliveryDate) },
    { key: 'progress', header: tSales('desk.progress'), hideBelow: 'lg', width: '160px', cell: (o) => (o.progressPercent != null ? <Meter value={o.progressPercent} max={100} size="sm" valueLabel={`${Math.round(o.progressPercent)}%`} tone={salesOrderTone(o.status)} /> : '—') },
    { key: 'total', header: oc.tCommon('total'), numeric: true, cell: (o) => oc.money(o.total) },
  ];
  return <DataBoard<SalesOrderRow> aria-label={t('activeOrders')} columns={columns} rows={rows} rowKey={(o) => o.id} rowHref={(o) => `/admin/sales-orders/${o.id}`} LinkComponent={Link} loading={loading} mobileRow={(o) => ({ title: o.number, meta: oc.status(o.status), trailing: <span>{oc.money(o.total)}</span> })} empty={<Board.Empty title={t('noOrders')} />} flush />;
}

function InvoicesTab({ rows, loading, openPdf }: { rows: InvoiceRow[]; loading: boolean; openPdf: ReturnType<typeof usePdfDownload>['openPdf'] }) {
  const copy = useDealerCopy();
  const oc = useOrdersCopy();
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const columns: DataColumn<InvoiceRow>[] = [
    { key: 'number', header: tc('number' as never), cell: (i) => <Ltr className="font-semibold text-[var(--maher-text-primary)]">{i.number}</Ltr> },
    { key: 'status', header: tc('status'), cell: (i) => <Stamp tone={invoiceTone(i.status, Number(i.outstandingAmount ?? 0), i.dueDate)} size="sm">{oc.status(i.status)}</Stamp> },
    { key: 'issue', header: tc('date'), hideBelow: 'md', cell: (i) => copy.date(i.issueDate) },
    { key: 'due', header: tc('dueDate' as never), hideBelow: 'lg', cell: (i) => copy.date(i.dueDate) },
    { key: 'total', header: tc('total'), numeric: true, hideBelow: 'md', cell: (i) => copy.money(i.total) },
    { key: 'out', header: t('amountLeft'), numeric: true, cell: (i) => <span className={Number(i.outstandingAmount ?? 0) > 0 ? 'font-semibold text-[var(--maher-error)]' : ''}>{copy.money(i.outstandingAmount)}</span> },
    {
      key: 'pdf',
      header: '',
      numeric: true,
      width: '48px',
      cell: (i) => (
        <Button size="sm" variant="ghost" aria-label={tc('pdf' as never)} onClick={(e) => (e.preventDefault(), e.stopPropagation(), openPdf({ path: `/api/v1/invoices/${i.id}/pdf`, documentName: i.number, filename: `${i.number}.pdf` }))}>
          <FileText className="h-4 w-4" />
        </Button>
      ),
    },
  ];
  return <DataBoard<InvoiceRow> aria-label={t('openInvoices')} columns={columns} rows={rows} rowKey={(i) => i.id} rowHref={(i) => `/admin/invoices/${i.id}`} LinkComponent={Link} loading={loading} mobileRow={(i) => ({ title: i.number, meta: oc.status(i.status), trailing: <span>{copy.money(i.outstandingAmount)}</span> })} empty={<Board.Empty title={t('noInvoices')} />} flush />;
}

function PaymentsTab({ rows, loading, openPdf }: { rows: PaymentRow[]; loading: boolean; openPdf: ReturnType<typeof usePdfDownload>['openPdf'] }) {
  const copy = useDealerCopy();
  const oc = useOrdersCopy();
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const columns: DataColumn<PaymentRow>[] = [
    { key: 'number', header: tc('number' as never), cell: (p) => <Ltr className="font-semibold text-[var(--maher-text-primary)]">{p.number}</Ltr> },
    { key: 'date', header: tc('date'), cell: (p) => copy.date(p.paymentDate ?? p.createdAt) },
    { key: 'method', header: tc('method' as never), hideBelow: 'md', cell: (p) => (p.method ? oc.status(p.method) : '—') },
    { key: 'alloc', header: tc('invoices' as never), hideBelow: 'lg', cell: (p) => (p.allocations?.length ? p.allocations.map((a) => a.invoice?.number).filter(Boolean).join(', ') : '—') },
    { key: 'amount', header: tc('amount' as never), numeric: true, cell: (p) => <span className="font-semibold text-[var(--maher-success)]">{copy.money(p.amount)}</span> },
    {
      key: 'pdf',
      header: '',
      numeric: true,
      width: '48px',
      cell: (p) => (
        <Button size="sm" variant="ghost" aria-label={tc('pdf' as never)} onClick={(e) => (e.preventDefault(), e.stopPropagation(), openPdf({ path: `/api/v1/payments/${p.id}/pdf`, documentName: p.number, filename: `${p.number}.pdf` }))}>
          <FileText className="h-4 w-4" />
        </Button>
      ),
    },
  ];
  return <DataBoard<PaymentRow> aria-label={t('amountPaid')} columns={columns} rows={rows} rowKey={(p) => p.id} rowHref={(p) => `/admin/payments/${p.id}`} LinkComponent={Link} loading={loading} mobileRow={(p) => ({ title: p.number, meta: copy.date(p.paymentDate ?? p.createdAt), trailing: <span>{copy.money(p.amount)}</span> })} empty={<Board.Empty title={t('noPayments')} />} flush />;
}

function ReturnsTab({ rows, loading }: { rows: ReturnRow[]; loading: boolean }) {
  const copy = useDealerCopy();
  const oc = useOrdersCopy();
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const tone = (r: ReturnRow): BoardTone => (r.approvalStatus === 'APPROVED' ? 'success' : r.approvalStatus === 'REJECTED' ? 'error' : r.approvalStatus === 'NEED_INFO' ? 'warning' : 'info');
  const columns: DataColumn<ReturnRow>[] = [
    {
      key: 'number',
      header: tc('number' as never),
      cell: (r) => (
        <span className="min-w-0">
          <Ltr className="block font-semibold text-[var(--maher-text-primary)]">{r.number}</Ltr>
          <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">{r.productDesc}</span>
        </span>
      ),
    },
    { key: 'status', header: tc('status'), cell: (r) => <Stamp tone={tone(r)} size="sm">{oc.status(r.approvalStatus ?? r.lifecycleState ?? '')}</Stamp> },
    { key: 'reason', header: tc('reason' as never), hideBelow: 'md', cell: (r) => oc.status(r.reason) },
    { key: 'qty', header: tc('quantity' as never), numeric: true, hideBelow: 'lg', cell: (r) => String(r.quantity) },
    { key: 'charge', header: tc('amount' as never), numeric: true, cell: (r) => (r.chargeAmount != null ? copy.money(r.chargeAmount) : '—') },
  ];
  return <DataBoard<ReturnRow> aria-label={t('returns')} columns={columns} rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/admin/returns/${r.id}`} LinkComponent={Link} loading={loading} mobileRow={(r) => ({ title: r.number, meta: r.productDesc, trailing: <Stamp tone={tone(r)} size="sm">{oc.status(r.approvalStatus ?? '')}</Stamp> })} empty={<Board.Empty title={t('noReturns')} />} flush />;
}

function PricesTab({ customerId, rows, loading }: { customerId: string; rows: DealerPriceRow[]; loading: boolean }) {
  const copy = useDealerCopy();
  const t = useTranslations('customers');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DealerPriceRow | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DealerPriceRow | null>(null);
  const products = useQuery({ queryKey: ['products-pick'], queryFn: () => apiFetch<Paginated<CatalogProduct>>('/api/v1/products?pageSize=100&isActive=true').then((r) => r.data), enabled: open });
  const priced = new Set(rows.map((r) => r.product?.id ?? r.productId).filter(Boolean));
  const refresh = () => qc.invalidateQueries({ queryKey: ['dealer-prices', customerId] });
  const save = useMutation({
    mutationFn: async () => {
      if ((!editing && !productId) || price == null || price < 0) throw new ApiClientError(t('dealerPriceRequired'), 400);
      if (editing) return apiFetch(`/api/v1/customers/${customerId}/dealer-prices/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ price }) });
      return apiFetch(`/api/v1/customers/${customerId}/dealer-prices`, { method: 'POST', body: JSON.stringify({ productId, price }) });
    },
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      toast.success(tCommon('saved'));
      await refresh();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (row: DealerPriceRow) => apiFetch(`/api/v1/customers/${customerId}/dealer-prices/${row.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setRemoving(null);
      await refresh();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const selected = products.data?.find((p) => p.id === productId);
  const columns: DataColumn<DealerPriceRow>[] = [
    {
      key: 'product',
      header: tc('product'),
      cell: (r) => (
        <span className="min-w-0">
          <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{r.product ? localizedName(copy.locale, r.product) : '—'}</span>
          <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{r.product?.sku}</Ltr>
        </span>
      ),
    },
    { key: 'base', header: tc('basePrice'), numeric: true, hideBelow: 'md', cell: (r) => copy.money(r.product?.basePrice) },
    {
      key: 'price',
      header: t('dealerPrice'),
      numeric: true,
      cell: (r) => {
        const base = Number(r.product?.basePrice ?? NaN);
        const p = Number(r.price);
        const diff = Number.isFinite(base) && base > 0 ? Math.round(((p - base) / base) * 100) : null;
        return (
          <span className="flex items-center justify-end gap-2">
            <span className="font-semibold text-[var(--maher-text-primary)]">{copy.money(p, r.currency)}</span>
            {diff != null && diff !== 0 ? <Stamp tone={diff < 0 ? 'warning' : 'success'} size="sm">{`${diff > 0 ? '+' : ''}${diff}%`}</Stamp> : null}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      numeric: true,
      width: '56px',
      cell: (r) => (
        <Menu
          aria-label={tCommon('actions')}
          trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>}
          items={[
            { id: 'edit', label: tCommon('edit'), icon: <Pencil className="h-4 w-4" />, onSelect: () => (setEditing(r), setProductId(r.product?.id ?? r.productId ?? null), setPrice(Number(r.price)), setError(null), setOpen(true)) },
            { id: 'del', label: tCommon('remove'), icon: <Trash2 className="h-4 w-4" />, tone: 'error', onSelect: () => setRemoving(r) },
          ]}
        />
      ),
    },
  ];
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <p className="text-[13px] text-[var(--maher-text-secondary)]">{t('priceListHint')}</p>
        <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => (setEditing(null), setProductId(null), setPrice(null), setError(null), setOpen(true))}>
          {t('addPrice')}
        </Button>
      </div>
      <DataBoard<DealerPriceRow> aria-label={t('priceList')} columns={columns} rows={rows} rowKey={(r) => r.id} loading={loading} mobileRow={(r) => ({ title: r.product ? localizedName(copy.locale, r.product) : '—', meta: r.product?.sku, trailing: <span>{copy.money(r.price, r.currency)}</span> })} empty={<Board.Empty title={t('noPrices')} description={t('priceListHint')} />} flush />
      <Sheet
        open={open}
        onClose={() => !save.isPending && setOpen(false)}
        title={editing ? tCommon('edit') : t('addPrice')}
        description={t('priceListHint')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {editing ? (
            <KeyFacts columns={2} facts={[{ label: tc('product'), value: editing.product ? localizedName(copy.locale, editing.product) : '—' }, { label: tc('basePrice'), value: copy.money(editing.product?.basePrice), ltr: true }]} />
          ) : (
            <Combobox
              label={tc('product')}
              value={productId}
              onChange={(v) => setProductId(v)}
              options={(products.data ?? []).filter((p) => !priced.has(p.id)).map((p) => ({ value: p.id, label: localizedName(copy.locale, p), description: `${p.sku} · ${copy.money(p.basePrice)}` }))}
              placeholder={tc('select')}
              emptyText={kit.combobox.empty}
              loadingText={kit.combobox.loading}
              clearLabel={kit.combobox.clear}
            />
          )}
          <MoneyField label={t('dealerPrice')} currency="ILS" value={price} onChange={setPrice} min={0} hint={selected ? `${tc('basePrice')}: ${copy.money(selected.basePrice)}` : undefined} />
        </div>
      </Sheet>
      <ConfirmDialog open={Boolean(removing)} title={tCommon('remove')} description={removing?.product ? localizedName(copy.locale, removing.product) : ''} danger confirmLabel={tCommon('remove')} cancelLabel={tCommon('cancel')} loading={remove.isPending} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing)} />
    </>
  );
}

function ActivityTab({ rows, loading }: { rows: ActivityRow[]; loading: boolean }) {
  const copy = useDealerCopy();
  const oc = useOrdersCopy();
  const t = useTranslations('customers');
  if (loading) return <BoardSkeleton header={false} rows={4} />;
  if (!rows.length) return <Board.Empty title={t('noActivity')} />;
  const items = rows.map((r) => ({
    id: r.id,
    time: copy.date(r.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    title: oc.status(r.action),
    description: r.entityType !== 'Customer' ? `${oc.status(r.entityType)} · ${r.entityId.slice(0, 8)}` : undefined,
    tone: (r.action.toLowerCase().includes('delete') || r.action.toLowerCase().includes('block') ? 'error' : r.action.toLowerCase().includes('create') ? 'success' : 'neutral') as BoardTone,
  }));
  return <Timeline items={items} dense className="px-5 py-4" />;
}

/* ── Side boards ─────────────────────────────────────────────────────────── */

function ContactsBoard({ customer, onChanged }: { customer: CustomerDetail; onChanged: () => Promise<unknown> }) {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', position: '' });
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new ApiClientError(t('contactNameRequired'), 400);
      const body = JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, position: form.position.trim() || undefined });
      return editing ? apiFetch(`/api/v1/customers/${customer.id}/contacts/${editing}`, { method: 'PATCH', body }) : apiFetch(`/api/v1/customers/${customer.id}/contacts`, { method: 'POST', body });
    },
    onSuccess: async () => {
      setOpen(false);
      toast.success(t('contactCreated'));
      await onChanged();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (cid: string) => apiFetch(`/api/v1/customers/${customer.id}/contacts/${cid}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setRemoving(null);
      await onChanged();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const contacts = customer.contacts ?? [];
  return (
    <Board tone="info">
      <Board.Header
        title={t('contacts')}
        meta={contacts.length ? <Stamp tone="info" size="sm">{contacts.length}</Stamp> : null}
        actions={
          <Button size="sm" variant="secondary" aria-label={t('addContact')} onClick={() => (setEditing(null), setForm({ name: '', phone: '', email: '', position: '' }), setError(null), setOpen(true))}>
            <Plus className="h-4 w-4" />
          </Button>
        }
      />
      {contacts.length === 0 ? (
        <Board.Empty title={t('addContact')} />
      ) : (
        <ul className="divide-y divide-[var(--maher-border)]">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">
                  {c.name}
                  {c.isPrimary ? <Stamp tone="info" size="sm" className="ms-2">{tCommon('primary')}</Stamp> : null}
                </span>
                {c.position ? <span className="block truncate text-[12px] text-[var(--maher-text-secondary)]">{c.position}</span> : null}
                <Ltr className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">{[c.phone, c.email].filter(Boolean).join(' · ')}</Ltr>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="maher-press inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--maher-text-secondary)] hover:bg-[var(--maher-surface-muted)]" aria-label={t('phone')}>
                    <Phone className="h-4 w-4" />
                  </a>
                ) : null}
                <Menu
                  aria-label={tCommon('actions')}
                  trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>}
                  items={[
                    { id: 'edit', label: t('editContact'), icon: <Pencil className="h-4 w-4" />, onSelect: () => (setEditing(c.id), setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', position: c.position ?? '' }), setError(null), setOpen(true)) },
                    { id: 'del', label: t('deleteContact'), icon: <Trash2 className="h-4 w-4" />, tone: 'error', onSelect: () => setRemoving(c.id) },
                  ]}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('editContact') : t('addContact')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Input label={t('contactName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t('position')} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <Input label={t('phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
          <Input label={t('email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" type="email" />
        </div>
      </Sheet>
      <ConfirmDialog open={Boolean(removing)} title={t('deleteContact')} description={contacts.find((c) => c.id === removing)?.name ?? ''} danger confirmLabel={tCommon('remove')} cancelLabel={tCommon('cancel')} loading={remove.isPending} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing)} />
    </Board>
  );
}

function AddressesBoard({ customer, onChanged }: { customer: CustomerDetail; onChanged: () => Promise<unknown> }) {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ label: 'Delivery', city: '', street: '', country: 'JO', isDefaultDelivery: true, isDefaultBilling: false });
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const addresses = customer.addresses ?? [];
  const save = useMutation({
    mutationFn: () => {
      if (!form.city.trim() || !form.label.trim()) throw new ApiClientError(t('addressRequired'), 400);
      const body = JSON.stringify({ ...form, city: form.city.trim(), street: form.street.trim() || undefined });
      return editing ? apiFetch(`/api/v1/customers/${customer.id}/addresses/${editing}`, { method: 'PATCH', body }) : apiFetch(`/api/v1/customers/${customer.id}/addresses`, { method: 'POST', body });
    },
    onSuccess: async () => {
      setOpen(false);
      toast.success(editing ? t('addressUpdated') : t('addressCreated'));
      await onChanged();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (aid: string) => apiFetch(`/api/v1/customers/${customer.id}/addresses/${aid}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setRemoving(null);
      toast.success(t('addressDeleted'));
      await onChanged();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  return (
    <Board tone="neutral">
      <Board.Header
        title={t('addresses')}
        meta={addresses.length ? <Stamp tone="neutral" size="sm">{addresses.length}</Stamp> : null}
        actions={
          <Button size="sm" variant="secondary" aria-label={t('addAddress')} onClick={() => (setEditing(null), setForm({ label: 'Delivery', city: '', street: '', country: 'JO', isDefaultDelivery: addresses.length === 0, isDefaultBilling: addresses.length === 0 }), setError(null), setOpen(true))}>
            <Plus className="h-4 w-4" />
          </Button>
        }
      />
      {addresses.length === 0 ? (
        <Board.Empty title={t('addAddress')} />
      ) : (
        <ul className="divide-y divide-[var(--maher-border)]">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--maher-text-tertiary)]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-[var(--maher-text-primary)]">
                  {a.label}
                  {a.isDefaultDelivery ? <Stamp tone="success" size="sm">{t('defaultDelivery')}</Stamp> : null}
                  {a.isDefaultBilling ? <Stamp tone="info" size="sm">{t('defaultBilling')}</Stamp> : null}
                </span>
                <span className="block text-[12px] text-[var(--maher-text-secondary)]">{[a.street, a.city, a.country].filter(Boolean).join(', ')}</span>
              </span>
              <Menu
                aria-label={tCommon('actions')}
                trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>}
                items={[
                  { id: 'edit', label: t('editAddress'), icon: <Pencil className="h-4 w-4" />, onSelect: () => (setEditing(a.id), setForm({ label: a.label, city: a.city, street: a.street ?? '', country: a.country, isDefaultDelivery: a.isDefaultDelivery, isDefaultBilling: a.isDefaultBilling }), setError(null), setOpen(true)) },
                  { id: 'del', label: t('deleteAddress'), icon: <Trash2 className="h-4 w-4" />, tone: 'error', onSelect: () => setRemoving(a.id) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('editAddress') : t('addAddress')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Input label={t('label')} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <Input label={t('city')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label={t('street')} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
          <Input label={t('country')} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} dir="ltr" maxLength={2} />
          <div className="space-y-2 rounded-[12px] border border-[var(--maher-border)] p-3">
            <p className="text-[12px] text-[var(--maher-text-secondary)]">{t('addressDefaultsHint')}</p>
            <Checkbox checked={form.isDefaultDelivery} onChange={(v) => setForm({ ...form, isDefaultDelivery: v })} label={t('defaultDelivery')} />
            <Checkbox checked={form.isDefaultBilling} onChange={(v) => setForm({ ...form, isDefaultBilling: v })} label={t('defaultBilling')} />
          </div>
        </div>
      </Sheet>
      <ConfirmDialog open={Boolean(removing)} title={t('deleteAddress')} description={t('deleteAddressConfirm')} danger confirmLabel={tCommon('remove')} cancelLabel={tCommon('cancel')} loading={remove.isPending} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing)} />
    </Board>
  );
}

function NotesBoard({ customerId, notes, loading, onChanged }: { customerId: string; notes: CommunicationNote[]; loading: boolean; onChanged: () => Promise<unknown> }) {
  const copy = useDealerCopy();
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      if (!summary.trim()) throw new ApiClientError(t('noteSummaryRequired'), 400);
      return apiFetch(`/api/v1/customers/${customerId}/communications`, { method: 'POST', body: JSON.stringify({ type: 'NOTE', summary: summary.trim() }) });
    },
    onSuccess: async () => {
      setOpen(false);
      setSummary('');
      toast.success(t('noteCreated'));
      await onChanged();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const items = notes.map((n) => ({
    id: n.id,
    time: copy.date(n.occurredAt ?? n.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    title: n.subject ?? n.summary,
    description: n.subject ? n.summary : undefined,
    actor: [n.employee?.firstName, n.employee?.lastName].filter(Boolean).join(' ') || undefined,
    tone: 'neutral' as BoardTone,
  }));
  return (
    <Board tone="neutral">
      <Board.Header
        title={t('communications')}
        description={t('notesHint')}
        actions={
          <Button size="sm" variant="secondary" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => (setSummary(''), setError(null), setOpen(true))}>
            {t('addNote')}
          </Button>
        }
      />
      {loading ? <BoardSkeleton header={false} rows={2} /> : items.length === 0 ? <Board.Empty title={t('noNotes')} description={t('notesHint')} /> : <Timeline items={items} dense className="px-5 py-4" />}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('addNote')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <TextArea label={t('noteSummary')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} />
        </div>
      </Sheet>
    </Board>
  );
}
