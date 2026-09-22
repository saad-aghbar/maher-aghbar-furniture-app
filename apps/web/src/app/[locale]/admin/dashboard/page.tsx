'use client';

import {
  ManagementDashboard,
  ManagementDashboardSkeleton,
} from '@/components/admin/management-dashboard';
import {
  LegacyAdminDashboard,
  type LegacyDashboardMetrics,
} from '@/components/admin/legacy-admin-dashboard';
import { RestrictedStaffDashboard } from '@/components/admin/restricted-staff-dashboard';
import {
  WarehouseStaffDashboard,
  type InventoryOverview,
} from '@/components/admin/warehouse-staff-dashboard';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import type { ManagementSummary } from '@/lib/management-summary';
import type { AuthUser } from '@maher/types';
import { can, resolveComposedHomeKind } from '@maher/permissions';
import { ErrorState } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

export default function DashboardPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
    staleTime: 5 * 60 * 1000,
  });

  const user = me.data;
  const canSales = can(user, 'report.sales.read');
  const canInvRead = can(user, 'inventory.read');
  const canQualityRead = can(user, 'quality-inspection.read');
  const homeKind = resolveComposedHomeKind(user ?? null);

  type DashboardPayload =
    | { kind: 'management'; data: ManagementSummary }
    | { kind: 'legacy'; data: LegacyDashboardMetrics };

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'management-or-legacy'],
    queryFn: async (): Promise<DashboardPayload> => {
      try {
        const data = await apiFetch<ManagementSummary>('/api/v1/reports/management-summary');
        return { kind: 'management', data };
      } catch (err) {
        // Transition: keep classic dashboard until management-summary ships.
        if (err instanceof ApiClientError && err.status === 404) {
          const data = await apiFetch<LegacyDashboardMetrics>('/api/v1/reports/dashboard');
          return { kind: 'legacy', data };
        }
        throw err;
      }
    },
    enabled: canSales,
    refetchInterval: canSales ? 60_000 : false,
  });

  const data = dashboardQuery.data?.kind === 'legacy' ? dashboardQuery.data.data : undefined;
  const management = dashboardQuery.data?.kind === 'management' ? dashboardQuery.data.data : undefined;
  const isLoading = dashboardQuery.isLoading;
  const isError = dashboardQuery.isError;
  const isSuccess = dashboardQuery.isSuccess;
  const refetch = dashboardQuery.refetch;

  const inventoryOverview = useQuery({
    queryKey: ['inventory-overview'],
    queryFn: () => apiFetch<InventoryOverview>('/api/v1/inventory/overview'),
    enabled: canInvRead,
    staleTime: 30_000,
  });

  const qualityAttention = useQuery({
    queryKey: ['quality-inspections', 'attention', 'dashboard'],
    queryFn: () => apiFetch<Array<{ reworkId?: string }>>('/api/v1/quality-inspections/attention'),
    enabled: canQualityRead && !management,
    staleTime: 30_000,
  });

  const qualityAttentionCount = qualityAttention.data?.length ?? 0;

  const firstName = useMemo(() => {
    const name = me.data?.name?.trim();
    if (!name) return null;
    return name.split(/\s+/)[0] ?? name;
  }, [me.data?.name]);

  const attentionTotal = useMemo(() => {
    if (!data) return qualityAttentionCount;
    return data.delayedOrders + data.pendingReturns + data.lowStockItems + qualityAttentionCount;
  }, [data, qualityAttentionCount]);

  const pipelineShares = useMemo(() => {
    if (!data) {
      return { newOrders: 0, production: 0, nearing: 0, completed: 0 };
    }
    const parts = [
      data.newOrders,
      data.ordersInProduction,
      data.ordersNearingDelivery,
      data.completedOrders,
    ] as const;
    const total = parts.reduce((s, n) => s + n, 0);
    if (total <= 0) {
      return { newOrders: 0, production: 0, nearing: 0, completed: 0 };
    }
    const raw = parts.map((n) => (n / total) * 100);
    const rounded = raw.map((n) => Math.round(n));
    const drift = 100 - rounded.reduce((s, n) => s + n, 0);
    if (drift !== 0) {
      let maxIdx = 0;
      for (let i = 1; i < rounded.length; i++) {
        if (rounded[i]! >= rounded[maxIdx]!) maxIdx = i;
      }
      rounded[maxIdx]! += drift;
    }
    return {
      newOrders: rounded[0]!,
      production: rounded[1]!,
      nearing: rounded[2]!,
      completed: rounded[3]!,
    };
  }, [data]);

  if (me.isLoading && !user) {
    return <ManagementDashboardSkeleton />;
  }

  if (!canSales) {
    if (homeKind === 'warehouse') {
      return (
        <WarehouseStaffDashboard
          firstName={firstName}
          overview={inventoryOverview.data}
          loading={inventoryOverview.isLoading}
          user={user}
        />
      );
    }
    return <RestrictedStaffDashboard firstName={firstName} />;
  }

  if (isLoading) {
    return <ManagementDashboardSkeleton />;
  }

  if (isError || (!management && !data)) {
    return (
      <ErrorState
        title={t('dashboard')}
        description={tCommon('noResults')}
        onRetry={() => refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  if (management) {
    return <ManagementDashboard data={management} firstName={firstName} />;
  }

  if (!data) {
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
    <LegacyAdminDashboard
      data={data}
      firstName={firstName}
      qualityAttentionCount={qualityAttentionCount}
      attentionTotal={attentionTotal}
      pipelineShares={pipelineShares}
      isSuccess={isSuccess}
      user={user}
    />
  );
}
