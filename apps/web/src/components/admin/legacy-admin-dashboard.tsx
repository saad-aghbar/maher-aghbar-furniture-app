'use client';

import { Link } from '@/i18n/navigation';
import type { AuthUser } from '@maher/types';
import { canAny, type Permission } from '@maher/permissions';
import {
  Board,
  Figure,
  Ledger,
  LedgerRow,
  Ltr,
  Ribbon,
  Stamp,
  StatusBadge,
  Ticket,
  type BoardTone,
} from '@maher/ui';
import {
  Armchair,
  ArrowUpRight,
  Banknote,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Factory,
  PackageCheck,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface LegacyRecentOrder {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  customerName: string | null;
  externalOrderNumber: string | null;
  endCustomerName: string | null;
}

export interface LegacyDashboardMetrics {
  newOrders: number;
  ordersInProduction: number;
  ordersNearingDelivery: number;
  completedOrders: number;
  delayedOrders: number;
  openInvoices: number;
  outstandingReceivables: number;
  dealersActive: number;
  pendingReturns: number;
  lowStockItems: number;
  recentOrders: LegacyRecentOrder[];
  generatedAt: string;
}

function money(value: number | undefined, currency: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toLocaleString('en-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Classic dashboard (`/reports/dashboard`) on the Board template.
 * Kept for API builds that predate management-summary.
 */
export function LegacyAdminDashboard({
  data,
  firstName,
  qualityAttentionCount,
  attentionTotal,
  pipelineShares,
  user,
}: {
  data: LegacyDashboardMetrics;
  firstName: string | null;
  qualityAttentionCount: number;
  attentionTotal: number;
  pipelineShares: { newOrders: number; production: number; nearing: number; completed: number };
  isSuccess: boolean;
  user?: AuthUser;
}) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const currency = tCommon('currency');

  const allQuick: Array<{ href: string; label: string; icon: LucideIcon; anyPermissions?: readonly Permission[] }> = [
    { href: '/admin/orders', label: t('orders'), icon: ShoppingCart, anyPermissions: ['request.read', 'quotation.read', 'sales-order.read'] },
    { href: '/admin/production', label: t('production'), icon: Factory, anyPermissions: ['production-order.read'] },
    { href: '/admin/products', label: t('products'), icon: Armchair, anyPermissions: ['catalog.read'] },
    { href: '/admin/customers', label: t('dealers'), icon: Users, anyPermissions: ['customer.read'] },
    { href: '/admin/inventory', label: t('inventory'), icon: Boxes, anyPermissions: ['inventory.read'] },
    { href: '/admin/purchasing', label: t('purchasing'), icon: Receipt, anyPermissions: ['purchase-order.read', 'supplier.read'] },
    { href: '/admin/invoices', label: t('invoices'), icon: Banknote, anyPermissions: ['invoice.read'] },
    { href: '/admin/returns', label: t('returns'), icon: RotateCcw, anyPermissions: ['return.read'] },
  ];
  const quickActions = allQuick.filter(
    (item) => !item.anyPermissions?.length || canAny(user, item.anyPermissions),
  );

  const tickets = (
    [
      { key: 'delayed', href: '/admin/production', label: tCommon('metricDelayedOrders'), value: data.delayedOrders, tone: 'error' },
      { key: 'returns', href: '/admin/returns', label: tCommon('metricPendingReturns'), value: data.pendingReturns, tone: 'warning' },
      { key: 'quality', href: '/admin/quality', label: tCommon('metricQualityAttention'), value: qualityAttentionCount, tone: 'warning' },
      { key: 'lowStock', href: '/admin/inventory', label: tCommon('metricLowStock'), value: data.lowStockItems, tone: 'info' },
    ] satisfies Array<{ key: string; href: string; label: string; value: number; tone: BoardTone }>
  ).filter((row) => row.value > 0);

  const pipeline: Array<{ key: string; href: string; label: string; value: number; share: number; tone: BoardTone; icon: LucideIcon }> = [
    { key: 'new', href: '/admin/orders', label: tCommon('metricNewOrders'), value: data.newOrders, share: pipelineShares.newOrders, tone: 'brand', icon: ClipboardList },
    { key: 'production', href: '/admin/production', label: tCommon('metricOrdersInProduction'), value: data.ordersInProduction, share: pipelineShares.production, tone: 'info', icon: Factory },
    { key: 'nearing', href: '/admin/sales-orders', label: tCommon('metricOrdersNearingDelivery'), value: data.ordersNearingDelivery, share: pipelineShares.nearing, tone: 'warning', icon: Truck },
    { key: 'done', href: '/admin/sales-orders?status=COMPLETED', label: tCommon('dealerStageDone'), value: data.completedOrders, share: pipelineShares.completed, tone: 'success', icon: PackageCheck },
  ];
  const heroTone: BoardTone = data.delayedOrders > 0 ? 'error' : attentionTotal > 0 ? 'warning' : 'success';

  return (
    <div className="maher-stagger space-y-5 pb-8">
      <Board tone={heroTone} wash="top" as="section">
        <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
            <p className="text-[13px] leading-5 text-[var(--maher-text-secondary)]">
              {tCommon('dashboardUpdated', {
                time: new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
              })}
            </p>
            <h1 className="mt-1 text-[26px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[30px] sm:leading-9">
              {firstName ? tCommon('dashboardGreetingNamed', { name: firstName }) : tCommon('dashboardGreeting')}
            </h1>
            <div className="mt-5 flex items-start gap-3">
              <Stamp tone={heroTone} className="mt-[7px]" />
              <div>
                <p className="text-[15px] font-semibold leading-6 text-[var(--maher-text-primary)]">
                  {attentionTotal === 0 ? tCommon('dashboardAllClear') : tickets[0]?.label}
                </p>
                <p className="mt-0.5 max-w-[52ch] text-[13px] leading-5 text-[var(--maher-text-secondary)]">
                  {tCommon('adminDashboardSubtitle')}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-2">
            {pipeline.map((p) => (
              <Link key={p.key} href={p.href} className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]">
                <Figure value={p.value} size="sm" label={p.label} tone={p.value > 0 ? (p.tone === 'brand' ? undefined : p.tone) : 'neutral'} />
              </Link>
            ))}
          </div>
        </div>
      </Board>

      <div className="grid gap-5 xl:grid-cols-12 xl:items-stretch">
        <div className="flex flex-col gap-5 xl:col-span-7">
          <Board tone={tickets.length ? heroTone : 'success'}>
            <Board.Header
              title={tCommon('mgmtSectionAttention')}
              description={tCommon('mgmtSectionAttentionHint')}
              meta={tickets.length ? <Stamp tone={heroTone} size="sm">{tickets.length}</Stamp> : null}
            />
            {tickets.length ? (
              <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
                {tickets.map((row) => (
                  <li key={row.key} className="m-0">
                    <Ticket
                      tone={row.tone}
                      wash={row.tone === 'error'}
                      title={row.label}
                      trailing={<span className="text-base font-semibold tabular-nums" dir="ltr">{row.value}</span>}
                      href={row.href}
                      LinkComponent={Link}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Board.Empty icon={<CheckCircle2 className="h-4 w-4" />} title={tCommon('deskAttentionEmptyTitle')} description={tCommon('deskAttentionEmptyBody')} />
            )}
          </Board>

          <Board>
            <Board.Header title={tCommon('adminPipelineTitle')} description={tCommon('adminLoadHint')} />
            <Board.Body>
              <Ribbon legend={false} segments={pipeline.map((p) => ({ key: p.key, value: p.value, label: p.label, tone: p.tone }))} />
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {pipeline.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Link key={p.key} href={p.href} className="maher-press flex flex-col gap-1 rounded-[12px] px-2 py-2 transition-colors hover:bg-[var(--maher-surface-muted)]">
                      <Icon className="h-3.5 w-3.5 text-[var(--maher-text-tertiary)]" aria-hidden />
                      <span className={p.value > 0 ? 'text-xl font-semibold leading-6 tabular-nums tracking-[-0.02em] text-[var(--maher-text-primary)]' : 'text-xl font-semibold leading-6 tabular-nums text-[var(--maher-text-tertiary)]'} dir="ltr">
                        {p.value}
                      </span>
                      <span className="text-[12px] leading-4 text-[var(--maher-text-secondary)]">{p.label}</span>
                      <span className="text-[11px] leading-4 tabular-nums text-[var(--maher-text-tertiary)]" dir="ltr">{p.share}%</span>
                    </Link>
                  );
                })}
              </div>
            </Board.Body>
          </Board>

          <Board className="xl:flex-1">
            <Board.Header
              title={tCommon('dashboardRecentOrders')}
              description={tCommon('dashboardRecentHint')}
              actions={
                <Link href="/admin/sales-orders" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--maher-brand)]">
                  {tCommon('viewAll')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </Link>
              }
            />
            {(data.recentOrders ?? []).length === 0 ? (
              <Board.Empty icon={<Armchair className="h-4 w-4" />} title={tCommon('dashboardNoRecentOrders')} />
            ) : (
              <Board.Body grow>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/admin/sales-orders/${order.id}`}
                      className="maher-press group flex flex-col overflow-hidden rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)] transition-colors hover:border-[color:color-mix(in_oklab,var(--maher-brand)_28%,var(--maher-border))]"
                    >
                      <div className="relative aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]">
                        {order.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={order.imageUrl} alt={order.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[var(--maher-text-tertiary)]">
                            <Armchair className="h-8 w-8 opacity-40" />
                          </div>
                        )}
                        <div className="absolute start-2 top-2 origin-top-start scale-90">
                          <StatusBadge status={order.status} />
                        </div>
                      </div>
                      <div className="space-y-1 p-3">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--maher-text-primary)]">{order.title}</p>
                        {order.customerName ? <p className="truncate text-xs text-[var(--maher-text-secondary)]">{order.customerName}</p> : null}
                        <p className="truncate text-[11px] text-[var(--maher-text-tertiary)]">
                          {order.externalOrderNumber ? (
                            <>{tSales('dealerOrderNumber')}: <Ltr>{order.externalOrderNumber}</Ltr></>
                          ) : (
                            <>{tSales('systemOrderNumber')}: <Ltr>{order.number}</Ltr></>
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </Board.Body>
            )}
          </Board>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          <Board tone={data.openInvoices > 0 ? 'brand' : 'success'}>
            <Board.Header title={tCommon('mgmtSectionMoney')} description={tCommon('mgmtSectionMoneyHint')} />
            <Board.Body>
              <Figure value={money(data.outstandingReceivables, currency)} label={tCommon('metricReceivables')} size="sm" />
              <Ledger className="mt-3 border-t border-[var(--maher-border)] pt-1">
                <LedgerRow label={tCommon('metricOutstandingInvoices')} value={data.openInvoices.toLocaleString('en-JO')} href="/admin/invoices" LinkComponent={Link} icon={<Banknote className="h-3.5 w-3.5" />} />
                <LedgerRow label={tCommon('metricActiveDealers')} value={data.dealersActive.toLocaleString('en-JO')} href="/admin/customers" LinkComponent={Link} icon={<Users className="h-3.5 w-3.5" />} />
                <LedgerRow label={tCommon('metricPendingReturns')} value={data.pendingReturns.toLocaleString('en-JO')} tone={data.pendingReturns > 0 ? 'warning' : 'neutral'} href="/admin/returns" LinkComponent={Link} icon={<RotateCcw className="h-3.5 w-3.5" />} />
              </Ledger>
            </Board.Body>
          </Board>

          {quickActions.length ? (
            <Board tone="neutral" className="xl:flex-1">
              <Board.Header stamp={false} title={tCommon('quickActions')} description={tCommon('dashboardQuickHint')} />
              <Board.Body padding="tight" grow>
                <ul className="m-0 grid list-none grid-cols-1 gap-x-2 p-0 sm:grid-cols-2">
                  {quickActions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <li key={a.href} className="m-0">
                        <Link href={a.href} className="maher-press group/jump flex min-h-[44px] items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm text-[var(--maher-text-primary)] transition-colors hover:bg-[var(--maher-surface-muted)]">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)] transition-colors group-hover/jump:bg-[var(--maher-brand-soft)] group-hover/jump:text-[var(--maher-brand)]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{a.label}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--maher-text-tertiary)] opacity-0 transition-opacity group-hover/jump:opacity-100 rtl:-scale-x-100" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Board.Body>
            </Board>
          ) : null}
        </div>
      </div>
    </div>
  );
}
