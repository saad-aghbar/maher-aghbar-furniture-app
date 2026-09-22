'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { Board, Button, Combobox, DateRangeField, FilterDrawer, SectionTabs, SegmentedControl, Stamp } from '@maher/ui';
import { SlidersHorizontal } from 'lucide-react';
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const kit = useKitCopy();
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

  const activeFilters = [filter.customerId, filter.productId, filter.status, filter.dateBasis, filter.complexity, filter.salesRepId].filter(Boolean).length;
  const presetOptions = [
    { value: 'today', label: ta('presetToday') },
    { value: 'week', label: ta('presetThisWeek') },
    { value: 'month', label: ta('presetThisMonth') },
    { value: 'custom', label: ta('presetCustom') },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{ta('reportsTitle')}</h1>
            <p className="mt-1 max-w-[64ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{ta('reportsSubtitle')}</p>
            <p className="mt-1 text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{ta('exportGapsNote')}</p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <SegmentedControl size="sm" aria-label={ta('presetCustom')} value={preset} onChange={(v) => applyPreset(v as DatePreset)} options={presetOptions} />
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeField
                from={filter.from}
                to={filter.to}
                onChange={(range) => {
                  setPreset('custom');
                  sync({ from: range.from, to: range.to });
                }}
                locale={locale}
                copy={kit.range}
              />
              <Button variant="secondary" size="sm" leadingIcon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setFiltersOpen(true)}>
                {kit.filters.title}
                {activeFilters ? <Stamp tone="brand" size="sm" className="ms-1">{activeFilters}</Stamp> : null}
              </Button>
            </div>
          </div>
        </div>
      </Board>

      <SectionTabs
        aria-label={ta('reportsTitle')}
        LinkComponent={Link}
        value={REPORTS_SECTIONS.find((section) => (section.href === '/admin/reports' ? pathname === '/admin/reports' : pathname === section.href || pathname.startsWith(`${section.href}/`)))?.href ?? '/admin/reports'}
        items={REPORTS_SECTIONS.map((section) => ({ id: section.href, label: ta(section.key), href: `${section.href}${qs}` }))}
      />

      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={kit.filters.title}
        applyLabel={kit.filters.apply}
        clearLabel={kit.filters.clear}
        closeLabel={kit.filters.close}
        count={activeFilters}
        onApply={() => setFiltersOpen(false)}
        onClear={() => {
          sync({ customerId: '', productId: '', status: '', dateBasis: '', complexity: '', salesRepId: '' });
          setFiltersOpen(false);
        }}
      >
        <div className="space-y-4">
          <Combobox label={ta('filterCustomer')} value={filter.customerId || null} onChange={(v) => sync({ customerId: v ?? '' })} options={(dealersQuery.data ?? []).map((c) => ({ value: c.id, label: localizedName(locale, c) || c.name || c.id }))} placeholder={ta('allCustomers')} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} />
          <Combobox label={ta('filterProduct')} value={filter.productId || null} onChange={(v) => sync({ productId: v ?? '' })} options={(productsQuery.data ?? []).map((p) => ({ value: p.id, label: localizedName(locale, p), description: p.sku ?? undefined }))} placeholder={ta('allProducts')} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} />
          <Combobox label={ta('filterSalesRep')} value={filter.salesRepId || null} onChange={(v) => sync({ salesRepId: v ?? '' })} options={(usersQuery.data ?? []).map((u) => ({ value: u.id, label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || u.id }))} placeholder={ta('allSalesReps')} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} />
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{ta('filterStatus')}</span>
            <Combobox value={filter.status || null} onChange={(v) => sync({ status: v ?? '' })} options={STATUS_OPTIONS.map((status) => ({ value: status, label: status.replace(/_/g, ' ') }))} placeholder={ta('allStatuses')} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{ta('dateBasis')}</span>
            <SegmentedControl
              size="sm"
              aria-label={ta('dateBasis')}
              value={filter.dateBasis || 'delivered'}
              onChange={(v) => sync({ dateBasis: v === 'delivered' ? '' : v })}
              options={[
                { value: 'delivered', label: ta('dateBasisDelivered') },
                { value: 'orderDate', label: ta('dateBasisOrder') },
                { value: 'activity', label: ta('dateBasisActivity') },
              ]}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{ta('complexityFilter')}</span>
            <SegmentedControl
              size="sm"
              aria-label={ta('complexityFilter')}
              value={filter.complexity || 'all'}
              onChange={(v) => sync({ complexity: v === 'all' ? '' : v })}
              options={[
                { value: 'all', label: ta('sectionAll') },
                { value: 'STANDARD', label: 'Standard' },
                { value: 'MODIFIED', label: 'Modified' },
                { value: 'CUSTOM', label: 'Custom' },
              ]}
            />
          </div>
        </div>
      </FilterDrawer>

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
    <Board tone="neutral">
      <Board.Empty title={title} description={hint} />
    </Board>
  );
}
