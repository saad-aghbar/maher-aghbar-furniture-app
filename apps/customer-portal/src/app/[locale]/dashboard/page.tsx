'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, MetricCard, PageHeader, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  FileText,
  FolderOpen,
  Package,
  Receipt,
  Scroll,
  SquarePen,
  Truck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function CustomerDashboard() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-me'],
    queryFn: () => apiFetch<{ name: string }>('/api/v1/auth/me'),
  });

  const quotes = useQuery({
    queryKey: ['customer-quotations'],
    queryFn: () =>
      apiFetch<{ data: unknown[] }>('/api/v1/quotations').catch(() => ({ data: [] })),
  });

  const orders = useQuery({
    queryKey: ['customer-orders-count'],
    queryFn: () =>
      apiFetch<{ data: unknown[] }>('/api/v1/sales-orders').catch(() => ({ data: [] })),
  });

  const invoices = useQuery({
    queryKey: ['customer-invoices-count'],
    queryFn: () =>
      apiFetch<{ data: unknown[] }>('/api/v1/invoices').catch(() => ({ data: [] })),
  });

  const deliveries = useQuery({
    queryKey: ['customer-deliveries-count'],
    queryFn: () =>
      apiFetch<{ data: unknown[] }>('/api/v1/deliveries').catch(() => ({ data: [] })),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[124px]" />
          <Skeleton className="h-[124px]" />
          <Skeleton className="h-[124px]" />
          <Skeleton className="h-[124px]" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState title={t('dashboard')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />
    );
  }

  const shortcuts = [
    { href: '/quotations/request', key: 'requestQuote', icon: SquarePen },
    { href: '/orders', key: 'orders', icon: Package },
    { href: '/deliveries', key: 'deliveries', icon: Truck },
    { href: '/invoices', key: 'invoices', icon: Receipt },
    { href: '/statement', key: 'statement', icon: Scroll },
    { href: '/documents', key: 'documents', icon: FolderOpen },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${tCommon('welcome')}${data?.name ? ` — ${data.name}` : ''}`}
        description={tCommon('customerDashboardSubtitle')}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t('myQuotes')}
          value={quotes.data?.data?.length ?? 0}
          tone="brand"
          icon={<FileText className="h-[18px] w-[18px]" />}
        />
        <MetricCard
          label={t('orders')}
          value={orders.data?.data?.length ?? 0}
          tone="info"
          icon={<Package className="h-[18px] w-[18px]" />}
        />
        <MetricCard
          label={t('deliveries')}
          value={deliveries.data?.data?.length ?? 0}
          tone="warning"
          icon={<Truck className="h-[18px] w-[18px]" />}
        />
        <MetricCard
          label={t('invoices')}
          value={invoices.data?.data?.length ?? 0}
          tone="success"
          icon={<Receipt className="h-[18px] w-[18px]" />}
        />
      </div>

      <Card title={tCommon('quickActions')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {shortcuts.map(({ href, key, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between gap-3 rounded-[var(--maher-radius-md)] border border-border bg-surface px-4 py-3 transition-all hover:border-brand/40 hover:bg-brand-soft"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[var(--maher-radius-md)] bg-surface-muted text-text-secondary transition-colors group-hover:bg-surface group-hover:text-brand">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-sm font-medium text-text-primary">{t(key)}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-text-tertiary transition-transform group-hover:text-brand rtl:rotate-180" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
