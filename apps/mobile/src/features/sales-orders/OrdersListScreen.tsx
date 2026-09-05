import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  UIManager,
  View,
} from 'react-native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { listRequests } from '@/api/modules/requests';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { alignStart, localeRow, useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import type { SalesOrderListItem } from './api';
import { AdminOrderCard } from './components/AdminOrderCard';
import {
  OrdersFilterChips,
  type StatusChipKey,
} from './components/OrdersFilterChips';
import { OrdersFilterButton } from './components/OrdersFilterButton';
import { OrdersSearchBar } from './components/OrdersSearchBar';
import {
  countActiveOrderFilters,
  defaultOrdersFilterDraft,
  OrdersFilterSheet,
  type OrdersFilterDealerOption,
  type OrdersFilterDraft,
} from './components/OrdersFilterSheet';
import { OrdersDealerSheet } from './components/OrdersDealerSheet';
import { OrdersLedgerHome } from './components/OrdersLedgerHome';
import { OrdersListSkeleton } from './components/OrdersListSkeleton';
import { OrdersPipelineHome } from './components/OrdersPipelineHome';
import { resolveOrderPrimaryCtaHref } from './resolveOrderPrimaryCtaHref';
import { OrdersSignatureHome } from './components/OrdersSignatureHome';
import { OrdersWorkbenchHome } from './components/OrdersWorkbenchHome';
import type { AdminLifecycleChipKey } from './components/AdminLifecycleChips';
import type { AdminOrdersDeskMode } from './components/AdminOrdersDeskSwitch';
import {
  RFQ_SUBCHIP_STATUS_GROUP,
  type RfqInboxSubchip,
} from './components/OrdersRfqInboxChips';
import type { OrderTypeFocus } from './components/OrderTypeLensBar';
import { matchOrdersSearch } from './matchOrdersSearch';
import { ORDERS_COMPOSITION } from './ordersComposition';
import { consumeOrdersDeskChip } from './ordersDeskContext';
import { flattenOrdersPages, flattenRequestsPages, useAdminRequestsInfiniteQuery, useOrdersInfiniteQuery } from './query';
import {
  toAdminOrderCard,
  toDealerOrderCard,
  type AdminOrderCardModel,
  type DealerOrderCardModel,
  type OrdersListVariant,
} from './selectOrderCard';
import { complexityBadgeKey } from './orderManufacturingKind';
import { getOwnDeliveries } from '@/api/modules/scheduling';
import {
  deliveryStatusFromCustomerStatus,
  type OrdersStageFocus,
} from './stageCounts';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type OrdersListScreenProps = {
  variant: OrdersListVariant;
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixture?: SalesOrderListItem[];
};

const defaultDraft: OrdersFilterDraft = defaultOrdersFilterDraft;

export function OrdersListScreen({
  variant,
  forceState,
  fixture,
}: OrdersListScreenProps) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const params = useLocalSearchParams<{
    focus?: string | string[];
    chip?: string | string[];
    desk?: string | string[];
    journey?: string | string[];
    late?: string | string[];
  }>();
  const allowed = can(user, 'sales-order.read');
  const canReadRequests = can(user, 'request.read');
  const composition = ORDERS_COMPOSITION;

  const detailHref = (id: string): Href =>
    variant === 'admin'
      ? (`/(app)/(admin)/orders/${id}` as Href)
      : (`/(app)/(customer)/orders/${id}` as Href);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [statusChip, setStatusChip] = useState<StatusChipKey>('all');
  /** Pipeline / workbench lane focus — client-side only (does not refetch). */
  const [stageFocus, setStageFocus] = useState<OrdersStageFocus>('all');
  /** Admin commercial desk — Sales Orders vs Customer Requests. */
  const [adminDeskMode, setAdminDeskMode] = useState<AdminOrdersDeskMode>('orders');
  /** Admin commercial desk lifecycle focus — server-scoped journeyBucket (COUNT=DATASET). */
  const [adminLifecycleFocus, setAdminLifecycleFocus] =
    useState<AdminLifecycleChipKey>('all');
  const [adminOrderType, setAdminOrderType] = useState<OrderTypeFocus>('all');
  const [adminRequestType, setAdminRequestType] = useState<OrderTypeFocus>('all');
  const [rfqSubchip, setRfqSubchip] = useState<RfqInboxSubchip>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dealerSheetOpen, setDealerSheetOpen] = useState(false);
  const [draft, setDraft] = useState<OrdersFilterDraft>(defaultDraft);
  const [applied, setApplied] = useState<OrdersFilterDraft>(defaultDraft);

  useEffect(() => {
    const seeded = consumeOrdersDeskChip();
    if (seeded && variant === 'admin') {
      setAdminDeskMode('orders');
      setAdminLifecycleFocus(seeded);
    }

    const rawDesk = Array.isArray(params.desk) ? params.desk[0] : params.desk;
    if (variant === 'admin' && (rawDesk === 'requests' || rawDesk === 'rfq')) {
      setAdminDeskMode('requests');
      setAdminLifecycleFocus('all');
      return;
    }

    const rawFocus = Array.isArray(params.focus) ? params.focus[0] : params.focus;
    const rawChip = Array.isArray(params.chip) ? params.chip[0] : params.chip;
    const rawJourney = Array.isArray(params.journey) ? params.journey[0] : params.journey;
    const rawLate = Array.isArray(params.late) ? params.late[0] : params.late;
    const raw = rawChip ?? rawFocus ?? rawJourney;
    if (!raw && rawLate !== 'true') return;

    const adminKeys = new Set([
      'preparing',
      'ready_to_start',
      'in_production',
      'ready_to_ship',
      'shipped',
      'delivered',
      'all',
    ]);
    if (variant === 'admin' && (raw === 'rfq' || raw === 'requests')) {
      setAdminDeskMode('requests');
      setAdminLifecycleFocus('all');
      return;
    }
    if (variant === 'admin' && (rawLate === 'true' || raw === 'needs_attention')) {
      // Attention is no longer a chip — land on All so overdue/hold stay visible with badges.
      setAdminDeskMode('orders');
      setAdminLifecycleFocus('all');
      return;
    }
    if (variant === 'admin' && raw && adminKeys.has(raw)) {
      setAdminDeskMode('orders');
      setAdminLifecycleFocus(raw as AdminLifecycleChipKey);
      return;
    }

    if (raw === 'drafts') setStatusChip('drafts');
    else if (raw === 'production') setStatusChip('production');
    else if (raw === 'ready') setStatusChip('ready');
    else if (raw === 'shipped') setStatusChip('shipped');
    else if (raw === 'delivered') setStatusChip('delivered');
  }, [params.chip, params.desk, params.focus, params.journey, params.late, variant]);

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  /**
   * Admin: server search via `q` (debounced). Sort via API.
   * Journey chip and type lens are server-scoped (COUNT=DATASET).
   * Only attach `q` on the Sales Orders desk — Customer Requests use their own query.
   */
  const filters = useMemo(
    () => ({
      sortBy: applied.sortBy,
      sortDir: applied.sortDir,
      ...(variant === 'admin' && adminDeskMode === 'orders' && q ? { q } : {}),
      ...(variant === 'admin' &&
      adminDeskMode === 'orders' &&
      adminLifecycleFocus &&
      adminLifecycleFocus !== 'all'
        ? {
            journeyBucket: adminLifecycleFocus as
              | 'preparing'
              | 'ready_to_start'
              | 'in_production'
              | 'ready_to_ship'
              | 'shipped'
              | 'delivered',
          }
        : {}),
      ...(variant === 'admin' &&
      adminDeskMode === 'orders' &&
      adminOrderType !== 'all'
        ? {
            orderType: adminOrderType.toUpperCase() as
              | 'STANDARD'
              | 'MODIFIED'
              | 'CUSTOM',
          }
        : {}),
    }),
    [
      adminDeskMode,
      adminLifecycleFocus,
      adminOrderType,
      applied.sortBy,
      applied.sortDir,
      q,
      variant,
    ],
  );

  const query = useOrdersInfiniteQuery(filters, allowed && !forceState);
  const seenOrdersBoard = useRef(false);
  if (query.data) seenOrdersBoard.current = true;

  /** Server journeyCounts — stable across pagination; never loadedRows.length. */
  const journeyCounts = useMemo(() => {
    const pages = query.data?.pages ?? [];
    for (let i = pages.length - 1; i >= 0; i -= 1) {
      const meta = pages[i]?.meta as
        | { journeyCounts?: Record<string, number> }
        | undefined;
      if (meta?.journeyCounts) return meta.journeyCounts;
    }
    return null;
  }, [query.data?.pages]);

  const orderTypeCounts = useMemo(() => {
    const pages = query.data?.pages ?? [];
    for (let i = pages.length - 1; i >= 0; i -= 1) {
      const meta = pages[i]?.meta as
        | { orderTypeCounts?: { standard: number; modified: number; custom: number } }
        | undefined;
      if (meta?.orderTypeCounts) return meta.orderTypeCounts;
    }
    return null;
  }, [query.data?.pages]);

  const requestSearchQ =
    variant === 'dealer' || (variant === 'admin' && adminDeskMode === 'requests')
      ? q
      : '';
  const adminRequestStatusGroup =
    adminDeskMode === 'requests'
      ? RFQ_SUBCHIP_STATUS_GROUP[rfqSubchip]
      : 'open_inbox';
  const adminRequestFilters = useMemo(
    () => ({
      statusGroup: adminRequestStatusGroup,
      ...(requestSearchQ ? { q: requestSearchQ } : {}),
      ...(adminDeskMode === 'requests' && adminRequestType !== 'all'
        ? {
            requestType: adminRequestType.toUpperCase() as
              | 'STANDARD'
              | 'MODIFIED'
              | 'CUSTOM',
          }
        : {}),
    }),
    [
      adminDeskMode,
      adminRequestStatusGroup,
      adminRequestType,
      requestSearchQ,
    ],
  );
  const adminRequestsQuery = useAdminRequestsInfiniteQuery(
    adminRequestFilters,
    variant === 'admin' && canReadRequests && !forceState,
  );
  const requestsQuery = useQuery({
    queryKey: queryKeys.requests.list({
      ordersHub: true,
      variant,
      q: requestSearchQ,
      statusGroup: 'all',
    }),
    queryFn: () =>
      listRequests({
        page: 1,
        pageSize: 50,
        q: requestSearchQ || undefined,
      }),
    enabled: variant === 'dealer' && canReadRequests && !forceState,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
  const requestTypeCounts = useMemo(() => {
    const pages = adminRequestsQuery.data?.pages ?? [];
    for (let i = pages.length - 1; i >= 0; i -= 1) {
      const meta = pages[i]?.meta;
      if (meta?.typeCounts) return meta.typeCounts;
    }
    return null;
  }, [adminRequestsQuery.data?.pages]);
  const requestInboxCounts = useMemo(() => {
    const pages = adminRequestsQuery.data?.pages ?? [];
    for (let i = pages.length - 1; i >= 0; i -= 1) {
      const meta = pages[i]?.meta;
      if (meta?.inboxCounts) return meta.inboxCounts;
    }
    return null;
  }, [adminRequestsQuery.data?.pages]);
  const requestsTotalItems =
    variant === 'admin'
      ? (requestInboxCounts?.all ??
        adminRequestsQuery.data?.pages?.[0]?.meta?.totalItems ??
        0)
      : (requestsQuery.data?.meta?.totalItems ??
        requestsQuery.data?.data?.length ??
        0);
  const ownDeliveriesQuery = useQuery({
    queryKey: queryKeys.scheduling.ownDeliveries(),
    queryFn: () => getOwnDeliveries(),
    enabled: variant === 'dealer' && allowed && !forceState,
    staleTime: 30_000,
  });
  const deliveryMetaBySoId = useMemo(() => {
    const map = new Map<
      string,
      { status: string; deliveredAt: string | null; quantity: number | null }
    >();
    for (const row of ownDeliveriesQuery.data?.data ?? []) {
      const status = deliveryStatusFromCustomerStatus(row.customerStatus);
      if (!status) continue;
      map.set(row.salesOrderId, {
        status,
        deliveredAt: row.actualDeliveryDate ?? null,
        quantity: row.quantity ?? null,
      });
    }
    return map;
  }, [ownDeliveriesQuery.data]);
  const deliveryStatusBySoId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, meta] of deliveryMetaBySoId) map.set(id, meta.status);
    return map;
  }, [deliveryMetaBySoId]);
  /** Pull-to-refresh only — not search / sort transitions (keepPreviousData). */
  const refreshing =
    (query.isRefetching &&
      !query.isFetchingNextPage &&
      !query.isPlaceholderData) ||
    (variant === 'admin' &&
      adminRequestsQuery.isRefetching &&
      !adminRequestsQuery.isFetchingNextPage &&
      !adminRequestsQuery.isPlaceholderData) ||
    (variant === 'dealer' &&
      requestsQuery.isRefetching &&
      !requestsQuery.isPlaceholderData) ||
    (variant === 'dealer' && ownDeliveriesQuery.isRefetching);
  const liveItems = flattenOrdersPages(query.data);

  const dealerHubItems: DealerOrderCardModel[] = useMemo(() => {
    if (variant !== 'dealer') return [];
    const rfqs: DealerOrderCardModel[] = (requestsQuery.data?.data ?? []).map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      title: r.title || r.externalOrderNumber || r.number,
      imageUrl: r.imageUrl ?? null,
      progressPercent:
        r.status === 'DRAFT' ? 5 : r.status === 'SUBMITTED' ? 15 : r.status === 'QUOTED' ? 40 : 25,
      progressLabel: r.status === 'DRAFT' ? 'Draft' : r.status === 'SUBMITTED' ? 'Submitted' : null,
      deliveryDate: null,
      arrivedAt: r.createdAt ?? null,
      externalOrderNumber: r.externalOrderNumber ?? null,
      sellerPrice: null,
      kind: 'rfq',
    }));
    const orders = (
      forceState === 'success' || forceState === 'offline'
        ? (fixture ?? [])
        : forceState === 'empty'
          ? []
          : liveItems
    ).map((item) => {
      const meta = deliveryMetaBySoId.get(item.id);
      const card = toDealerOrderCard(item);
      return {
        ...card,
        deliveryStatus: meta?.status ?? deliveryStatusBySoId.get(item.id) ?? null,
        arrivedAt:
          meta?.status === 'DELIVERED' && meta.deliveredAt
            ? meta.deliveredAt
            : card.arrivedAt,
        kind: 'order' as const,
        quantity: meta?.quantity ?? null,
      };
    });

    let merged = [...rfqs, ...orders];
    if (q) {
      merged = merged.filter((item) =>
        matchOrdersSearch(
          {
            number: item.number,
            title: item.title,
            externalOrderNumber: item.externalOrderNumber,
            deliveryDate: item.deliveryDate,
            dealerName: undefined,
          },
          q,
        ),
      );
    }
    // Status focus is applied in OrdersSignatureHome so focus-rail counts stay honest.
    return merged;
  }, [
    variant,
    requestsQuery.data,
    forceState,
    fixture,
    liveItems,
    q,
    deliveryMetaBySoId,
    deliveryStatusBySoId,
  ]);

  const items: SalesOrderListItem[] =
    forceState === 'success' || forceState === 'offline'
      ? (fixture ?? [])
      : forceState === 'empty'
        ? []
        : liveItems;

  const searchedItems = useMemo(() => {
    // Admin search is server-side via filters.q — avoid double-filtering pages.
    if (variant === 'admin' || !q) return items;
    return items.filter((item) =>
      matchOrdersSearch(
        {
          number: item.number,
          title: item.title,
          externalOrderNumber: item.externalOrderNumber,
          requiredDeliveryDate: item.requiredDeliveryDate,
          projectName: item.projectName,
          customer: item.customer,
          productionOrderNumbers: (item.productionOrders ?? []).map((po) => po.number),
        },
        q,
      ),
    );
  }, [items, q, variant]);

  /** Dealer / delivery on sales orders — client-side. Approval applied after RFQ merge. */
  const refinedSalesOrders = useMemo(() => {
    let rows = searchedItems;
    if (applied.dealerId !== 'all') {
      rows = rows.filter((item) => (item.customer?.id ?? '') === applied.dealerId);
    }
    if (applied.deliveryFrom) {
      rows = rows.filter((item) => {
        const d = item.requiredDeliveryDate?.slice(0, 10);
        return Boolean(d && d >= applied.deliveryFrom);
      });
    }
    if (applied.deliveryTo) {
      rows = rows.filter((item) => {
        const d = item.requiredDeliveryDate?.slice(0, 10);
        return Boolean(d && d <= applied.deliveryTo);
      });
    }
    return rows;
  }, [
    applied.dealerId,
    applied.deliveryFrom,
    applied.deliveryTo,
    searchedItems,
  ]);

  const adminRfqCards: AdminOrderCardModel[] = useMemo(() => {
    if (variant !== 'admin' || !canReadRequests) return [];
    if (forceState === 'empty') return [];
    if (
      adminDeskMode === 'requests' &&
      adminRequestType !== 'all' &&
      requestTypeCounts &&
      requestTypeCounts[adminRequestType] === 0
    ) {
      return [];
    }
    let rows = flattenRequestsPages(adminRequestsQuery.data);
    if (applied.dealerId !== 'all') {
      rows = rows.filter((r) => (r.customer?.id ?? '') === applied.dealerId);
    }
    return rows.map((r) => {
      const dealerName = r.customer
        ? localizedName(locale, r.customer, r.customer.code || '—')
        : '—';
      return {
        id: r.id,
        number: r.number,
        status: r.status,
        priority: r.priority ?? 'NORMAL',
        title: r.title || r.externalOrderNumber || r.number,
        imageUrl: r.imageUrl ?? null,
        dealerId: r.customer?.id ?? '',
        dealerName,
        /** RFQ inbox — never invent fake production progress. */
        progressPercent: null,
        progressLabel: t('mobile.orders.customerRequestLabel'),
        deliveryDate: null,
        arrivedAt: r.createdAt ?? null,
        externalOrderNumber: r.externalOrderNumber ?? null,
        productionOrderNumbers: [],
        manufacturingCost: null,
        sellerPrice: null,
        profit: null,
        lifecycle: 'rfq' as const,
        actionHint: null,
        kind: 'rfq' as const,
        manufacturingKind: complexityBadgeKey(r.manufacturingComplexity),
      };
    });
  }, [
    adminDeskMode,
    adminRequestType,
    adminRequestsQuery.data,
    applied.dealerId,
    canReadRequests,
    forceState,
    locale,
    requestTypeCounts,
    t,
    variant,
  ]);

  const dealerOptions: OrdersFilterDealerOption[] = useMemo(() => {
    if (variant !== 'admin') return [];
    const map = new Map<string, OrdersFilterDealerOption>();
    const addCustomer = (
      id: string,
      customer: {
        name?: string | null;
        nameAr?: string | null;
        nameEn?: string | null;
        nameHe?: string | null;
        code?: string | null;
      } | null | undefined,
    ) => {
      if (!id) return;
      const name = customer
        ? localizedName(locale, customer, customer.code || '—')
        : '—';
      const searchText = [
        customer?.nameEn,
        customer?.nameAr,
        customer?.nameHe,
        customer?.name,
        customer?.code,
      ]
        .filter(Boolean)
        .join(' ');
      const prev = map.get(id);
      if (prev) prev.count += 1;
      else map.set(id, { id, name, searchText, count: 1 });
    };
    for (const item of items) {
      addCustomer(item.customer?.id ?? '', item.customer);
    }
    for (const r of flattenRequestsPages(adminRequestsQuery.data)) {
      addCustomer(r.customer?.id ?? '', r.customer);
    }
    for (const r of requestsQuery.data?.data ?? []) {
      addCustomer(r.customer?.id ?? '', r.customer);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [adminRequestsQuery.data, items, locale, requestsQuery.data, variant]);

  const adminSalesOrderCards: AdminOrderCardModel[] = useMemo(() => {
    if (
      adminOrderType !== 'all' &&
      orderTypeCounts &&
      orderTypeCounts[adminOrderType] === 0
    ) {
      return [];
    }
    const orders = refinedSalesOrders.map((item) => toAdminOrderCard(item, locale));
    const seen = new Set<string>();
    return orders.filter((row) => {
      const key = `order:${row.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [adminOrderType, locale, orderTypeCounts, refinedSalesOrders]);

  /** Desk stream — Sales Orders and Customer Requests never share one list. */
  const adminCards: AdminOrderCardModel[] = useMemo(() => {
    if (adminDeskMode === 'requests') return adminRfqCards;
    return adminSalesOrderCards;
  }, [adminDeskMode, adminRfqCards, adminSalesOrderCards]);

  const filterActiveCount = countActiveOrderFilters(applied, {
    includeDealers: variant === 'admin',
    includeApproval: false,
  });

  const onChipChange = (next: StatusChipKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStatusChip(next);
    setStageFocus(
      next === 'pending' || next === 'production' || next === 'ready' ? next : 'all',
    );
  };

  const onStageFocusChange = (next: OrdersStageFocus) => {
    setStageFocus(next);
    setStatusChip(next === 'all' ? 'all' : next);
  };

  const onAdminDeskModeChange = (next: AdminOrdersDeskMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdminDeskMode(next);
    if (next === 'requests') {
      setAdminLifecycleFocus('all');
      router.setParams({ focus: 'requests', chip: undefined });
    } else {
      router.setParams({ focus: undefined, chip: undefined });
    }
  };

  const onAdminLifecycleFocusChange = (next: AdminLifecycleChipKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdminDeskMode('orders');
    setAdminLifecycleFocus(next);
    // Persist lifecycle chip so list → detail → back restores Preparing/Attention/etc.
    router.setParams({
      focus: next === 'all' ? undefined : next,
      chip: next === 'all' ? undefined : next,
    });
  };

  const selectedDealerLabel =
    applied.dealerId === 'all'
      ? null
      : (dealerOptions.find((d) => d.id === applied.dealerId)?.name ?? null);

  const onDealerSelect = (next: { id: string; name: string } | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const dealerId = next?.id ?? 'all';
    setApplied((prev) => ({ ...prev, dealerId }));
    setDraft((prev) => ({ ...prev, dealerId }));
  };

  const onPressItem = (id: string, kind?: 'order' | 'rfq') => {
    if (kind === 'rfq') {
      router.push(
        (variant === 'admin'
          ? `/(app)/(admin)/requests/${id}`
          : `/(app)/(customer)/requests/${id}`) as Href,
      );
      return;
    }
    router.push(detailHref(id));
  };

  const onPrimaryCta = (order: {
    id: string;
    kind?: 'order' | 'rfq';
    lifecycle?: import('./adminOrderLifecycle').AdminOrderLifecycle;
    primaryCta?: import('./adminOrderJourney').JourneyPrimaryCta;
    primaryProductionOrderId?: string | null;
    productionReadinessSummary?: { primaryProductionOrderId?: string | null } | null;
    journeyLogistics?: import('@/api/modules/sales-orders').SalesOrderJourneyLogistics | null;
  }) => {
    if (order.kind === 'rfq') {
      onPressItem(order.id, 'rfq');
      return;
    }
    router.push(
      resolveOrderPrimaryCtaHref({
        salesOrderId: order.id,
        lifecycle: order.lifecycle,
        primaryCta: order.primaryCta,
        primaryProductionOrderId:
          order.primaryProductionOrderId ??
          order.productionReadinessSummary?.primaryProductionOrderId ??
          null,
        journeyLogistics: order.journeyLogistics ?? null,
      }),
    );
  };

  const onRefresh = () => {
    void query.refetch();
    if (variant === 'admin') void adminRequestsQuery.refetch();
    if (variant === 'dealer') {
      void requestsQuery.refetch();
      void ownDeliveriesQuery.refetch();
    }
  };

  const onEndReached = () => {
    if (forceState) return;
    if (variant === 'admin' && adminDeskMode === 'requests') {
      if (adminRequestsQuery.hasNextPage && !adminRequestsQuery.isFetchingNextPage) {
        void adminRequestsQuery.fetchNextPage();
      }
      return;
    }
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  };

  const classicHeader = (
    <OrdersHeader
      searchInput={searchInput}
      setSearchInput={setSearchInput}
      statusChip={statusChip}
      onChipChange={onChipChange}
      filterActiveCount={filterActiveCount}
      onOpenFilters={() => {
        setDraft(applied);
        setSheetOpen(true);
      }}
    />
  );

  const openFilters = () => {
    setDraft(applied);
    setSheetOpen(true);
  };

  const banner: ReactNode =
    showOfflineBanner || forceState === 'offline' ? <OfflineBanner /> : null;

  const filterSheet = (
    <OrdersFilterSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      draft={draft}
      onChange={setDraft}
      showDealers={variant === 'admin'}
      showApproval={false}
      dealers={dealerOptions}
      onReset={() => {
        setDraft(defaultDraft);
        setApplied(defaultDraft);
        setStatusChip('all');
        setStageFocus('all');
        setAdminLifecycleFocus('all');
        setAdminOrderType('all');
        setAdminRequestType('all');
        setRfqSubchip('all');
        setAdminDeskMode('orders');
        setSheetOpen(false);
      }}
      onApply={() => {
        setApplied(draft);
        setSheetOpen(false);
      }}
    />
  );

  const dealerSheet =
    variant === 'admin' ? (
      <OrdersDealerSheet
        open={dealerSheetOpen}
        onClose={() => setDealerSheetOpen(false)}
        dealers={dealerOptions}
        selectedId={applied.dealerId === 'all' ? null : applied.dealerId}
        onSelect={onDealerSelect}
      />
    ) : null;

  if (
    forceState === 'loading' ||
    (allowed &&
      adminDeskMode !== 'requests' &&
      !seenOrdersBoard.current &&
      query.isLoading &&
      !query.data &&
      !query.isPlaceholderData &&
      !forceState)
  ) {
    return (
      <AppScreen>
        {classicHeader}
        <OrdersListSkeleton />
      </AppScreen>
    );
  }

  if (!allowed && !forceState) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (forceState === 'error' || (query.isError && !query.data && !forceState)) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        {classicHeader}
        <ErrorState
          title={t('mobile.orders.errorTitle')}
          description={t('mobile.orders.errorBody')}
          retryLabel={t('mobile.orders.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const sharedCompositionProps = {
    variant,
    adminItems: adminCards,
    dealerItems: dealerHubItems,
    stageFocus,
    onStageFocusChange,
    searchInput,
    setSearchInput,
    onOpenFilters: openFilters,
    filterActiveCount,
    refreshing: forceState ? false : refreshing,
    onRefresh,
    onEndReached,
    isFetchingNextPage: Boolean(
      adminDeskMode === 'requests'
        ? adminRequestsQuery.isFetchingNextPage
        : query.isFetchingNextPage,
    ),
    onPressItem,
    onPrimaryCta: variant === 'admin' ? onPrimaryCta : undefined,
    banner,
  };

  if (composition === 'signature' || variant === 'dealer') {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <OrdersSignatureHome
          {...sharedCompositionProps}
          deskMode={adminDeskMode}
          onDeskModeChange={variant === 'admin' ? onAdminDeskModeChange : undefined}
          ordersCount={journeyCounts?.all ?? 0}
          requestsCount={requestsTotalItems}
          statusChip={statusChip}
          onStatusChipChange={onChipChange}
          adminLifecycleFocus={adminLifecycleFocus}
          onAdminLifecycleFocusChange={
            variant === 'admin' ? onAdminLifecycleFocusChange : undefined
          }
          journeyCounts={journeyCounts}
          orderTypeFocus={
            adminDeskMode === 'requests' ? adminRequestType : adminOrderType
          }
          onOrderTypeFocusChange={
            variant === 'admin'
              ? (next) => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  if (adminDeskMode === 'requests') setAdminRequestType(next);
                  else setAdminOrderType(next);
                }
              : undefined
          }
          orderTypeCounts={
            adminDeskMode === 'requests' ? requestTypeCounts : orderTypeCounts
          }
          rfqSubchip={rfqSubchip}
          onRfqSubchipChange={variant === 'admin' ? setRfqSubchip : undefined}
          requestInboxCounts={requestInboxCounts}
          dealerLabel={variant === 'admin' ? selectedDealerLabel : null}
          onOpenDealerFilter={
            variant === 'admin' ? () => setDealerSheetOpen(true) : undefined
          }
          onClearDealerFilter={
            variant === 'admin' ? () => onDealerSelect(null) : undefined
          }
        />
        {filterSheet}
        {dealerSheet}
      </AppScreen>
    );
  }

  if (composition === 'pipeline') {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <OrdersPipelineHome {...sharedCompositionProps} />
        {filterSheet}
      </AppScreen>
    );
  }

  if (composition === 'workbench') {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <OrdersWorkbenchHome {...sharedCompositionProps} />
        {filterSheet}
      </AppScreen>
    );
  }

  if (composition === 'ledger') {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <OrdersLedgerHome {...sharedCompositionProps} />
        {filterSheet}
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: theme.spacing.lg }}>
        {banner}
        {classicHeader}
      </View>
      <FlatList
        data={adminCards}
        keyExtractor={(item) => (item.kind === 'rfq' ? `rfq-${item.id}` : item.id)}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: insets.bottom + SURFACE_TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        refreshControl={
          forceState ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
            />
          )
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <EmptyState
            title={
              q
                ? t('mobile.orders.searchEmpty')
                : t('mobile.orders.emptyTitle')
            }
            description={
              q
                ? t('mobile.orders.emptySearchBody')
                : t('mobile.orders.emptyBody')
            }
          />
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={{ paddingVertical: theme.spacing.lg }}>
              <OrdersListSkeleton />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <AdminOrderCard
            order={item}
            index={index}
            onPress={() => onPressItem(item.id, item.kind)}
          />
        )}
      />
      {filterSheet}
    </AppScreen>
  );
}

function OrdersHeader({
  searchInput,
  setSearchInput,
  statusChip,
  onChipChange,
  onOpenFilters,
  filterActiveCount = 0,
}: {
  searchInput: string;
  setSearchInput: (v: string) => void;
  statusChip: StatusChipKey;
  onChipChange: (v: StatusChipKey) => void;
  onOpenFilters: () => void;
  filterActiveCount?: number;
}) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View
        style={{
          flexDirection: localeRow(isRTL),
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            flex: 1,
            gap: theme.spacing.xs,
            minWidth: 0,
            alignItems: alignStart(isRTL),
          }}
        >
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            align="start"
            style={{
              letterSpacing: locale === 'ar' ? 0 : 0.2,
              color: colors.brand,
            }}
          >
            {t('mobile.orders.pulseEyebrow')}
          </AppText>
          <AppText variant="largeTitle" weight={titleWeight} align="start">
            {t('mobile.orders.title')}
          </AppText>
          <AppText
            variant="caption"
            numberOfLines={2}
            align="start"
            style={{ fontSize: 12, lineHeight: 16, color: colors.brand }}
          >
            {t('mobile.orders.subtitle')}
          </AppText>
        </View>
        <OrdersFilterButton onPress={onOpenFilters} activeCount={filterActiveCount} />
      </View>
      <OrdersSearchBar
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder={t('mobile.orders.searchPlaceholder')}
      />
      <OrdersFilterChips value={statusChip} onChange={onChipChange} />
    </View>
  );
}
