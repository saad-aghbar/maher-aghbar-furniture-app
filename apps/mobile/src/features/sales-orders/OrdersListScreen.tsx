import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  UIManager,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { listRequests } from '@/api/modules/requests';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import type { SalesOrderListItem } from './api';
import { AdminOrderCard } from './components/AdminOrderCard';
import {
  OrdersFilterChips,
  type StatusChipKey,
} from './components/OrdersFilterChips';
import { OrdersFilterButton } from './components/OrdersFilterButton';
import {
  countActiveOrderFilters,
  defaultOrdersFilterDraft,
  matchesApprovalFilter,
  OrdersFilterSheet,
  type OrdersApprovalFilter,
  type OrdersFilterDealerOption,
  type OrdersFilterDraft,
} from './components/OrdersFilterSheet';
import { OrdersDealerSheet } from './components/OrdersDealerSheet';
import { OrdersLedgerHome } from './components/OrdersLedgerHome';
import { OrdersListSkeleton } from './components/OrdersListSkeleton';
import { OrdersPipelineHome } from './components/OrdersPipelineHome';
import { OrdersSignatureHome } from './components/OrdersSignatureHome';
import { OrdersWorkbenchHome } from './components/OrdersWorkbenchHome';
import { matchOrdersSearch } from './matchOrdersSearch';
import { ORDERS_COMPOSITION } from './ordersComposition';
import { flattenOrdersPages, useOrdersInfiniteQuery } from './query';
import {
  toAdminOrderCard,
  toDealerOrderCard,
  type AdminOrderCardModel,
  type DealerOrderCardModel,
  type OrdersListVariant,
} from './selectOrderCard';
import { type OrdersStageFocus } from './stageCounts';

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
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string | string[] }>();
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dealerSheetOpen, setDealerSheetOpen] = useState(false);
  const [draft, setDraft] = useState<OrdersFilterDraft>(defaultDraft);
  const [applied, setApplied] = useState<OrdersFilterDraft>(defaultDraft);

  useEffect(() => {
    const raw = Array.isArray(params.focus) ? params.focus[0] : params.focus;
    if (raw === 'drafts') setStatusChip('drafts');
  }, [params.focus]);

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  /** Sort only via API — search/status/delivery/dealer filter client-side (spine + list stay in sync, no refetch thrash). */
  const filters = {
    sortBy: applied.sortBy,
    sortDir: applied.sortDir,
  };

  const query = useOrdersInfiniteQuery(filters, allowed && !forceState);
  const requestsQuery = useQuery({
    queryKey: queryKeys.requests.list({ ordersHub: true, variant, q }),
    queryFn: () => listRequests({ page: 1, pageSize: 50, q: q || undefined }),
    enabled:
      (variant === 'dealer' || variant === 'admin') &&
      canReadRequests &&
      !forceState,
    staleTime: 15_000,
  });
  const refreshing =
    (query.isRefetching && !query.isFetchingNextPage) || requestsQuery.isRefetching;
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
    ).map((item) => ({ ...toDealerOrderCard(item), kind: 'order' as const }));

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
  }, [variant, requestsQuery.data, forceState, fixture, liveItems, q]);

  const items: SalesOrderListItem[] =
    forceState === 'success' || forceState === 'offline'
      ? (fixture ?? [])
      : forceState === 'empty'
        ? []
        : liveItems;

  const searchedItems = useMemo(() => {
    if (!q) return items;
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
  }, [items, q]);

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
    let rows = requestsQuery.data?.data ?? [];
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
        progressPercent:
          r.status === 'DRAFT'
            ? 5
            : r.status === 'SUBMITTED'
              ? 15
              : r.status === 'UNDER_REVIEW'
                ? 25
                : r.status === 'READY_FOR_QUOTATION'
                  ? 35
                  : r.status === 'NEEDS_INFORMATION'
                    ? 20
                    : r.status === 'QUOTED'
                      ? 40
                      : 25,
        progressLabel: (() => {
          switch (r.status) {
            case 'DRAFT':
              return t('mobile.adminRequest.submit');
            case 'SUBMITTED':
              return t('mobile.adminRequest.underReview');
            case 'UNDER_REVIEW':
              return t('mobile.adminRequest.underReview');
            case 'READY_FOR_QUOTATION':
              return t('mobile.adminRequest.readyForQuote');
            case 'NEEDS_INFORMATION':
              return t('mobile.adminRequest.needsInfo');
            case 'QUOTED':
              return t('mobile.adminRequest.stages.quotation');
            default:
              return t('mobile.orders.unapprovedLabel');
          }
        })(),
        deliveryDate: null,
        arrivedAt: r.createdAt ?? null,
        externalOrderNumber: r.externalOrderNumber ?? null,
        productionOrderNumbers: [],
        manufacturingCost: null,
        sellerPrice: null,
        profit: null,
        kind: 'rfq' as const,
      };
    });
  }, [
    applied.dealerId,
    canReadRequests,
    forceState,
    locale,
    requestsQuery.data,
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
    for (const r of requestsQuery.data?.data ?? []) {
      addCustomer(r.customer?.id ?? '', r.customer);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [items, locale, requestsQuery.data, variant]);

  const adminCards: AdminOrderCardModel[] = useMemo(() => {
    const orders = refinedSalesOrders.map((item) => toAdminOrderCard(item, locale));
    const merged = [...adminRfqCards, ...orders];
    const filtered =
      applied.approval === 'any'
        ? merged
        : merged.filter((row) =>
            matchesApprovalFilter(row.status, applied.approval, {
              kind: row.kind ?? 'order',
            }),
          );
    // Dedupe by kind+id so SectionList keys stay unique (pagination / RFQ merge).
    const seen = new Set<string>();
    return filtered.filter((row) => {
      const key = `${row.kind ?? 'order'}:${row.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [adminRfqCards, applied.approval, locale, refinedSalesOrders]);

  const filterActiveCount = countActiveOrderFilters(applied, {
    includeDealers: variant === 'admin',
    includeApproval: variant === 'admin',
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

  const onApprovalChange = (next: OrdersApprovalFilter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setApplied((prev) => ({ ...prev, approval: next }));
    setDraft((prev) => ({ ...prev, approval: next }));
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

  const onRefresh = () => {
    void query.refetch();
    if (variant === 'dealer' || variant === 'admin') void requestsQuery.refetch();
  };

  const onEndReached = () => {
    if (!forceState && query.hasNextPage && !query.isFetchingNextPage) {
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
      showApproval={variant === 'admin'}
      dealers={dealerOptions}
      onReset={() => {
        setDraft(defaultDraft);
        setApplied(defaultDraft);
        setStatusChip('all');
        setStageFocus('all');
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

  if (forceState === 'loading' || (allowed && query.isLoading && !query.data && !forceState)) {
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
    isFetchingNextPage: Boolean(query.isFetchingNextPage),
    onPressItem,
    banner,
  };

  if (composition === 'signature' || variant === 'dealer') {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <OrdersSignatureHome
          {...sharedCompositionProps}
          approval={applied.approval}
          onApprovalChange={onApprovalChange}
          statusChip={statusChip}
          onStatusChipChange={onChipChange}
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
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
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
            title={t('mobile.orders.emptyTitle')}
            description={t('mobile.orders.emptyBody')}
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
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs, minWidth: 0 }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
            }}
          >
            {t('mobile.orders.pulseEyebrow')}
          </AppText>
          <AppText variant="title" weight={titleWeight}>
            {t('mobile.orders.title')}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            numberOfLines={1}
            style={{ fontSize: 12, lineHeight: 16 }}
          >
            {t('mobile.orders.subtitle')}
          </AppText>
        </View>
        <OrdersFilterButton onPress={onOpenFilters} activeCount={filterActiveCount} />
      </View>
      <TextField
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder={t('mobile.orders.searchPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <OrdersFilterChips value={statusChip} onChange={onChipChange} />
    </View>
  );
}
