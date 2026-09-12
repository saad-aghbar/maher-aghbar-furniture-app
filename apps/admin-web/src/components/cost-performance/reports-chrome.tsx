'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Button, Input, PageHero, Select } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  REPORTS_SECTIONS,
  detectPreset,
  filterFromSearchParams,
  filterQueryString,
  utcThisMonthBounds,
  utcThisWeekBounds,
  utcTodayBounds,
  type DatePreset,
  type ReportsFilter,
} from './reports-query';

type DealerOption = {
  id: string;
  name?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
};
type ProductOption = {
  id: string;
  sku?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
};
type UserOption = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

const STATUS_OPTIONS = [
  'IN_PRODUCTION',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
];

export function ReportsChrome({ children }: { children: ReactNode }) {
  const ta = useTranslations('accounting');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = useMemo(() => filterFromSearchParams(searchParams), [searchParams]);
  const [preset, setPreset] = useState<DatePreset>(() => detectPreset(filter.from, filter.to));
  const qs = filterQueryString(filter);

  const dealersQuery = useQuery({
    queryKey: ['reports-dealers'],
    queryFn: () =>
      apiFetch<{ data: DealerOption[] }>('/api/v1/customers?page=1&pageSize=100').then((r) => r.data),
  });
  const productsQuery = useQuery({
    queryKey: ['reports-products'],
    queryFn: () =>
      apiFetch<{ data: ProductOption[] }>('/api/v1/products?page=1&pageSize=100').then((r) => r.data),
  });
  const usersQuery = useQuery({
    queryKey: ['reports-users'],
    queryFn: () =>
      apiFetch<{ data: UserOption[] }>('/api/v1/users?page=1&pageSize=100').then((r) => r.data),
  });

  const sync = useCallback(
    (next: Partial<ReportsFilter>) => {
      const merged = { ...filter, ...next, page: next.page ?? '' };
      const nextQs = filterQueryString(merged);
      router.replace(nextQs ? `${pathname}${nextQs}` : pathname);
    },
    [filter, pathname, router],
  );

  function applyPreset(next: DatePreset) {
    setPreset(next);
    if (next === 'custom') return;
    const bounds =
      next === 'today' ? utcTodayBounds() : next === 'week' ? utcThisWeekBounds() : utcThisMonthBounds();
    sync({ from: bounds.from, to: bounds.to });
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={ta('reportsTitle')}
        description={`${ta('reportsSubtitle')} ${ta('exportGapsNote')}`}
        tone="soft"
      />

      <nav className="flex flex-wrap gap-2" aria-label={ta('reportsTitle')}>
        {REPORTS_SECTIONS.map((section) => {
          const active =
            section.href === '/reports'
              ? pathname === '/reports'
              : pathname === section.href || pathname.startsWith(`${section.href}/`);
          return (
            <Link
              key={section.href}
              href={`${section.href}${qs}`}
              className={
                active
                  ? 'rounded-full border border-[var(--maher-brand)] bg-[var(--maher-brand-soft,transparent)] px-3 py-1.5 text-sm font-medium'
                  : 'rounded-full border border-transparent px-3 py-1.5 text-sm underline'
              }
            >
              {ta(section.key)}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['today', ta('presetToday')],
              ['week', ta('presetThisWeek')],
              ['month', ta('presetThisMonth')],
              ['custom', ta('presetCustom')],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={preset === key ? 'primary' : 'subtle'}
              onClick={() => applyPreset(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            type="date"
            label={ta('dateFrom')}
            value={filter.from}
            onChange={(e) => {
              setPreset('custom');
              sync({ from: e.target.value });
            }}
            className="w-40"
          />
          <Input
            type="date"
            label={ta('dateTo')}
            value={filter.to}
            onChange={(e) => {
              setPreset('custom');
              sync({ to: e.target.value });
            }}
            className="w-40"
          />
          <Select
            label={ta('filterCustomer')}
            value={filter.customerId}
            onChange={(e) => sync({ customerId: e.target.value })}
            className="min-w-[10rem]"
            options={[
              { value: '', label: ta('allCustomers') },
              ...(dealersQuery.data ?? []).map((c) => ({
                value: c.id,
                label: localizedName(locale, c) || c.name || c.id,
              })),
            ]}
          />
          <Select
            label={ta('filterProduct')}
            value={filter.productId}
            onChange={(e) => sync({ productId: e.target.value })}
            className="min-w-[10rem]"
            options={[
              { value: '', label: ta('allProducts') },
              ...(productsQuery.data ?? []).map((p) => ({
                value: p.id,
                label: localizedName(locale, p),
              })),
            ]}
          />
          <Select
            label={ta('filterStatus')}
            value={filter.status}
            onChange={(e) => sync({ status: e.target.value })}
            className="min-w-[10rem]"
            options={[
              { value: '', label: ta('allStatuses') },
              ...STATUS_OPTIONS.map((status) => ({ value: status, label: status.replace(/_/g, ' ') })),
            ]}
          />
          <Select
            label={ta('filterSalesRep')}
            value={filter.salesRepId}
            onChange={(e) => sync({ salesRepId: e.target.value })}
            className="min-w-[10rem]"
            options={[
              { value: '', label: ta('allSalesReps') },
              ...(usersQuery.data ?? []).map((u) => ({
                value: u.id,
                label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || u.id,
              })),
            ]}
          />
        </div>
      </div>

      {children}
    </div>
  );
}

export function useReportsFilterQs() {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const filter = filterFromSearchParams(searchParams);
    return filterQueryString(filter);
  }, [searchParams]);
}

export function NotConfiguredSlot({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
