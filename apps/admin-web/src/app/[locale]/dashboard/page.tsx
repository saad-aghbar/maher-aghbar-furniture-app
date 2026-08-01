'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, MetricCard, Skeleton, type MetricTone } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ClockAlert,
  Factory,
  PackageSearch,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DashboardMetrics {
  activeOrders: number;
  ordersDueSoon: number;
  delayedProduction: number;
  waitingMaterials: number;
  pendingQuoteApprovals: number;
  outstandingInvoices: number;
  lowStock: number;
  criticalBlockers: number;
  dailyCompletions: number;
  revenueInvoiced?: number;
  receivablesAmount?: number;
  completedSalesOrders?: number;
  openPurchases?: number;
}

const metricSpecs: Array<{
  field: keyof DashboardMetrics;
  labelKey: string;
  icon: LucideIcon;
  tone: MetricTone;
  href: string;
  format?: 'money' | 'count';
}> = [
  { field: 'activeOrders', labelKey: 'metricActiveOrders', icon: ShoppingCart, tone: 'brand', href: '/sales-orders' },
  { field: 'ordersDueSoon', labelKey: 'metricOrdersDueSoon', icon: CalendarClock, tone: 'info', href: '/sales-orders' },
  { field: 'delayedProduction', labelKey: 'metricDelayedProduction', icon: ClockAlert, tone: 'warning', href: '/production' },
  {
    field: 'waitingMaterials',
    labelKey: 'metricWaitingMaterials',
    icon: PackageSearch,
    tone: 'warning',
    href: '/production?status=WAITING_FOR_MATERIALS',
  },
  {
    field: 'pendingQuoteApprovals',
    labelKey: 'metricPendingQuoteApprovals',
    icon: ClipboardList,
    tone: 'info',
    href: '/quotations?status=INTERNAL_REVIEW',
  },
  {
    field: 'outstandingInvoices',
    labelKey: 'metricOutstandingInvoices',
    icon: Banknote,
    tone: 'brand',
    href: '/invoices?status=ISSUED',
  },
  {
    field: 'revenueInvoiced',
    labelKey: 'metricRevenueInvoiced',
    icon: Banknote,
    tone: 'success',
    format: 'money',
    href: '/invoices',
  },
  {
    field: 'receivablesAmount',
    labelKey: 'metricReceivables',
    icon: Banknote,
    tone: 'warning',
    format: 'money',
    href: '/invoices?status=OVERDUE',
  },
  {
    field: 'completedSalesOrders',
    labelKey: 'metricCompletedOrders',
    icon: CheckCircle2,
    tone: 'success',
    href: '/sales-orders?status=COMPLETED',
  },
  { field: 'openPurchases', labelKey: 'metricOpenPurchases', icon: Boxes, tone: 'info', href: '/purchasing' },
  { field: 'lowStock', labelKey: 'metricLowStock', icon: Boxes, tone: 'warning', href: '/inventory' },
  { field: 'criticalBlockers', labelKey: 'metricCriticalBlockers', icon: AlertTriangle, tone: 'error', href: '/production' },
  {
    field: 'dailyCompletions',
    labelKey: 'metricDailyCompletions',
    icon: CheckCircle2,
    tone: 'success',
    href: '/production?status=COMPLETED',
  },
];

const quickLinks: Array<{ href: string; navKey: string; icon: LucideIcon }> = [
  { href: '/requests', navKey: 'rfqRequests', icon: ClipboardList },
  { href: '/quotations', navKey: 'quotations', icon: ClipboardList },
  { href: '/sales-orders', navKey: 'salesOrders', icon: ShoppingCart },
  { href: '/production', navKey: 'production', icon: Factory },
  { href: '/deliveries', navKey: 'deliveries', icon: Truck },
  { href: '/inventory', navKey: 'inventory', icon: Boxes },
  { href: '/invoices', navKey: 'invoices', icon: Banknote },
];

export default function DashboardPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardMetrics>('/api/v1/reports/dashboard'),
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2 border-b border-border pb-5">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-[124px]" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title={t('dashboard')}
        description={tCommon('noResults')}
        onRetry={() => refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t('dashboard')} description={tCommon('dashboardSubtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metricSpecs.map(({ field, labelKey, icon: Icon, tone, format, href }) => {
          const raw = data[field] ?? 0;
          const value =
            format === 'money' ? (
              <span dir="ltr">
                {Number(raw).toLocaleString('ar-JO')} {tCommon('currency')}
              </span>
            ) : (
              <span dir="ltr">{raw}</span>
            );
          return (
            <Link key={field} href={href} className="block focus-visible:outline-none">
              <MetricCard
                label={tCommon(labelKey)}
                value={value}
                tone={tone}
                icon={<Icon className="h-[18px] w-[18px]" />}
                className="h-full transition-transform hover:-translate-y-0.5"
              />
            </Link>
          );
        })}
      </div>

      <Card title={tCommon('quickActions')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map(({ href, navKey, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-[var(--maher-radius-md)] border border-border bg-surface px-4 py-3 transition-all hover:border-brand/40 hover:bg-brand-soft"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--maher-radius-md)] bg-surface-muted text-text-secondary transition-colors group-hover:bg-surface group-hover:text-brand">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-sm font-medium text-text-primary">{t(navKey)}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
