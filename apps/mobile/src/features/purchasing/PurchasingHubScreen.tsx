import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { listWarehouses } from '@/api/modules/inventory';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { useSurfaceClearance } from '@/adaptive/useSurfaceClearance';
import { useTheme } from '@/theme';
import { PurchaseOrderBoardCard } from './components/PurchaseOrderBoardCard';
import { PurchasingBuyAlertCard } from './components/PurchasingBuyAlertCard';
import { OrderFabricGroupCard } from '@/features/fabric/OrderFabricGroupCard';
import {
  fabricRowHref,
  filterFabricRowsByPurchasingStatus,
  groupFabricRowsBySalesOrder,
  selectFabricTrackerRows,
} from '@/features/fabric/selectFabricTracker';
import { PurchasingFilterTriggers, PURCHASING_CHROME_GAP } from './components/PurchasingFilterTriggers';
import { PurchasingHeroActions } from './components/PurchasingHeroActions';
import { PurchasingStatusFilterSheet } from './components/PurchasingStatusFilterSheet';
import { PurchasingSupplierSheet } from './components/PurchasingSupplierSheet';
import { PurchasingTabBar } from './components/PurchasingTabBar';
import { PurchasingSkeleton } from './components/PurchasingSkeleton';
import { SupplierInvoiceBoardCard } from './components/SupplierInvoiceBoardCard';
import {
  isStatusFilterActive,
  statusFiltersForTab,
  type PurchasingHubTab,
  type PurchasingSupplierOption,
} from './purchasingFilters';
import {
  flattenPurchaseOrders,
  flattenSupplierInvoices,
  useBuyAlertQuery,
  usePurchaseOrdersInfiniteQuery,
  useSupplierInvoicesInfiniteQuery,
  useSuppliersQuery,
  useFabricProcurementsQuery,
} from './query';
import {
  humanizeWarehouseLabel,
  selectPurchaseCard,
  selectSupplierInvoiceCard,
} from './selectPurchase';

const LIST_BOTTOM_EXTRA = 48;

function PurchasingTitle({
  backFallback,
  titleWeight,
}: {
  backFallback: Href;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;
  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          zIndex: 1,
          justifyContent: 'center',
        }}
      >
        <ScreenBackLead fallback={backFallback} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('navigation.purchasing')}
      </AppText>
    </View>
  );
}

type Props = {
  selectedOrderId?: string;
  onSelectOrder?: (id: string) => void;
};

export function PurchasingHubScreen({ selectedOrderId, onSelectOrder }: Props = {}) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const surfaceClearance = useSurfaceClearance();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/(tabs)' as Href;

  const canPo = can(user, 'purchase-order.read');
  const canPr = can(user, 'purchase-request.read');
  const canSi = can(user, 'supplier-invoice.read');
  const canCreatePo = can(user, 'purchase-order.create');
  const canReadSupplier = can(user, 'supplier.read');
  const canFabric = can(user, 'fabric.procurement.read');
  const canReadOrder = can(user, 'sales-order.read');

  const routeParams = useLocalSearchParams<{
    tab?: string;
    focus?: string;
    needs?: string;
    arriving?: string;
    late?: string;
    supplierId?: string;
  }>();

  const initialTab: PurchasingHubTab = (() => {
    const raw = String(routeParams.tab ?? '').trim();
    if (raw === 'orders' || raw === 'invoices' || raw === 'fabric') return raw;
    if (raw === 'requests') return 'orders';
    return canPo ? 'orders' : canFabric ? 'fabric' : 'invoices';
  })();
  const [tab, setTab] = useState<PurchasingHubTab>(initialTab);
  const requestedTab = String(routeParams.tab ?? '').trim();
  useEffect(() => {
    if (requestedTab === 'orders' || requestedTab === 'invoices' || requestedTab === 'fabric') {
      setTab(requestedTab);
      setStatus('ALL');
    }
    if (requestedTab === 'requests') {
      setTab('orders');
      setStatus('ALL');
    }
  }, [requestedTab]);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [supplierId, setSupplierId] = useState<string | null>(
    routeParams.supplierId ? String(routeParams.supplierId) : null,
  );
  const [supplierLabel, setSupplierLabel] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);
  const [warehouseLabel, setWarehouseLabel] = useState<string | null>(null);
  const [supplierSheetOpen, setSupplierSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setStatus('ALL');
  }, [tab]);

  const filters = {
    q: q || undefined,
    status: status === 'ALL' ? undefined : status,
    supplierId: supplierId || undefined,
    warehouseId,
    dateFrom: dateFrom.trim() || undefined,
    dateTo: dateTo.trim() || undefined,
  };

  const poQuery = usePurchaseOrdersInfiniteQuery(filters, canPo);
  const siQuery = useSupplierInvoicesInfiniteQuery(filters, canSi);
  const buyAlertQuery = useBuyAlertQuery(canPo && tab === 'orders');
  const fabricQuery = useFabricProcurementsQuery(
    {
      q: q || undefined,
      state: status === 'ALL' || status === 'ARRIVED' || status === 'PARTIAL' ? undefined : status,
      supplierId: supplierId || undefined,
    },
    canFabric && tab === 'fabric',
  );
  const suppliersQuery = useSuppliersQuery(canPo || canPr || canSi, { status: 'ACTIVE' });
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-purchasing-hub'],
    queryFn: listWarehouses,
    enabled: canPo,
  });

  const supplierOpenOrders = useMemo(() => {
    const map = new Map<string, Array<{ id: string; number: string; status: string }>>();
    for (const po of flattenPurchaseOrders(poQuery.data)) {
      if (!po.supplierId) continue;
      const open = po.status !== 'CLOSED' && po.status !== 'CANCELLED' && po.status !== 'RECEIVED';
      if (!open) continue;
      const list = map.get(po.supplierId) ?? [];
      list.push({ id: po.id, number: po.number, status: po.status });
      map.set(po.supplierId, list);
    }
    return map;
  }, [poQuery.data]);

  const supplierOptions: PurchasingSupplierOption[] = useMemo(() => {
    return (suppliersQuery.data?.data ?? []).map((s) => {
      const name = localizedName(
        locale,
        { name: s.name, nameEn: s.nameEn, nameAr: s.nameAr, nameHe: s.nameHe },
        s.code,
      );
      return {
        id: s.id,
        name,
        code: s.code,
        searchText: [s.name, s.nameEn, s.nameAr, s.nameHe, s.code].filter(Boolean).join(' '),
      };
    });
  }, [suppliersQuery.data?.data, locale]);

  const warehouseOptions = useMemo(
    () =>
      (warehousesQuery.data ?? [])
        .filter((w) => w.isActive !== false)
        .map((w) => {
          const typeLabel = humanizeWarehouseLabel(w.type, t);
          const subtitle = [w.code, typeLabel].filter(Boolean).join(' · ') || undefined;
          return {
            id: w.id,
            name:
              locale === 'ar'
                ? w.nameAr || w.nameEn || w.code
                : w.nameEn || w.nameAr || w.code,
            subtitle,
          };
        }),
    [warehousesQuery.data, locale, t],
  );

  useEffect(() => {
    if (!supplierId) {
      setSupplierLabel(null);
      return;
    }
    const found = supplierOptions.find((s) => s.id === supplierId);
    if (found) setSupplierLabel(found.name);
  }, [supplierId, supplierOptions]);

  const poCards = useMemo(
    () => flattenPurchaseOrders(poQuery.data).map((po) => selectPurchaseCard(po, locale)),
    [poQuery.data, locale],
  );
  const siCards = useMemo(
    () => flattenSupplierInvoices(siQuery.data).map((inv) => selectSupplierInvoiceCard(inv, locale)),
    [siQuery.data, locale],
  );
  const fabricRows = useMemo(() => {
    const rows = selectFabricTrackerRows(fabricQuery.data ?? []);
    return filterFabricRowsByPurchasingStatus(rows, status);
  }, [fabricQuery.data, status]);
  const fabricGroups = useMemo(() => groupFabricRowsBySalesOrder(fabricRows), [fabricRows]);
  const activeQuery =
    tab === 'orders' ? poQuery : tab === 'fabric' ? fabricQuery : siQuery;
  const listData =
    tab === 'orders' ? poCards : tab === 'fabric' ? fabricGroups : siCards;

  const poCount = poQuery.data?.pages[0]?.meta?.totalItems;
  const siCount = siQuery.data?.pages[0]?.meta?.totalItems;
  const ordersCount = typeof poCount === 'number' ? poCount : undefined;

  const statusLabel = isStatusFilterActive(status)
    ? (() => {
        const key = `statuses.${status}`;
        const translated = t(key);
        return translated === key ? status : translated;
      })()
    : t('mobile.purchasing.filter');
  const filterActive = isStatusFilterActive(status) || Boolean(dateFrom || dateTo || warehouseId);

  const searchPlaceholder =
    tab === 'orders'
      ? t('mobile.purchasing.searchOrders')
      : tab === 'fabric'
        ? t('mobile.purchasing.searchFabric')
        : t('mobile.purchasing.searchInvoices');

  if (!canPo && !canPr && !canSi && !canFabric) {
    return (
      <AppScreen>
        <PurchasingTitle backFallback={backFallback} titleWeight={titleWeight} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (activeQuery.isError && !activeQuery.data) {
    return (
      <AppScreen>
        <PurchasingTitle backFallback={backFallback} titleWeight={titleWeight} />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void activeQuery.refetch()}
        />
      </AppScreen>
    );
  }

  const tabs: Array<{ key: PurchasingHubTab; label: string; show: boolean; count?: number }> = [
    {
      key: 'orders',
      label: t('catalog.purchaseOrders'),
      show: canPo || canPr,
      count: ordersCount,
    },
    {
      key: 'invoices',
      label: t('catalog.supplierInvoices'),
      show: canSi,
      count: typeof siCount === 'number' ? siCount : undefined,
    },
    {
      key: 'fabric',
      label: t('mobile.purchasing.tabFabric'),
      show: canFabric,
      count: fabricRows.length || undefined,
    },
  ];

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        style={{ flex: 1 }}
        data={listData as Array<{ id: string }>}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
        }}
        ListFooterComponent={
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              height: theme.spacing['3xl'] + LIST_BOTTOM_EXTRA + surfaceClearance,
            }}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={
              tab === 'fabric'
                ? fabricQuery.isRefetching
                : Boolean(activeQuery.isRefetching && !('isFetchingNextPage' in activeQuery && activeQuery.isFetchingNextPage))
            }
            onRefresh={() => void activeQuery.refetch()}
            tintColor={colors.brand}
          />
        }
        onEndReached={() => {
          if (tab === 'fabric') return;
          if ('hasNextPage' in activeQuery && activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
            void activeQuery.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <PurchasingTitle backFallback={backFallback} titleWeight={titleWeight} />

            <PurchasingHeroActions
              canCreatePo={canCreatePo}
              canReadSuppliers={canReadSupplier}
              onNewOrder={() => router.push('/(app)/(admin)/purchasing/new' as Href)}
              onLowStock={() => router.push('/(app)/(admin)/purchasing/low-stock' as Href)}
              onSuppliers={() => router.push('/(app)/(admin)/purchasing/suppliers' as Href)}
            />

            <PurchasingTabBar
              tabs={tabs.filter((x) => x.show)}
              value={tab}
              onChange={(next) => {
                setTab(next);
                setStatus('ALL');
              }}
            />
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {tab === 'orders'
                ? t('mobile.purchasing.tabOrdersHint')
                : tab === 'fabric'
                  ? t('mobile.purchasing.tabFabricHint')
                  : t('mobile.purchasing.tabInvoicesHint')}
            </AppText>

            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                padding: theme.spacing.md,
                gap: PURCHASING_CHROME_GAP,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <TextField
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
                pill
              />
              <PurchasingFilterTriggers
                supplierLabel={supplierLabel}
                onOpenSuppliers={() => setSupplierSheetOpen(true)}
                onClearSupplier={() => {
                  setSupplierId(null);
                  setSupplierLabel(null);
                }}
                warehouseLabel={warehouseLabel}
                onOpenWarehouse={() => setStatusSheetOpen(true)}
                onClearWarehouse={() => {
                  setWarehouseId(undefined);
                  setWarehouseLabel(null);
                }}
                statusActive={filterActive}
                statusLabel={statusLabel}
                onOpenStatus={() => setStatusSheetOpen(true)}
              />
            </View>

            {canPo && tab === 'orders' ? (
              <PurchasingBuyAlertCard
                count={buyAlertQuery.data?.count ?? 0}
                onPress={() => router.push('/(app)/(admin)/purchasing/low-stock' as Href)}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          activeQuery.isLoading ? (
            <PurchasingSkeleton />
          ) : (
            <EmptyState
              title={
                q
                  ? t('mobile.purchasing.emptySearchTitle')
                  : tab === 'orders'
                    ? t('catalog.noPurchaseOrders')
                    : tab === 'fabric'
                      ? t('mobile.purchasing.emptyFabricTitle')
                      : t('catalog.noSupplierInvoices')
              }
              description={
                q
                  ? t('mobile.purchasing.emptySearchBody')
                  : tab === 'fabric'
                    ? t('mobile.purchasing.emptyFabricBody')
                    : t('mobile.purchasing.emptyBody')
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            {tab === 'orders' ? (
                <PurchaseOrderBoardCard
                  order={item as ReturnType<typeof selectPurchaseCard>}
                  selected={
                    selectedOrderId === (item as ReturnType<typeof selectPurchaseCard>).id
                  }
                  onPress={() => {
                    const order = item as ReturnType<typeof selectPurchaseCard>;
                    if (order.runId && (order.runSupplierCount ?? 0) > 1) {
                      router.push(`/(app)/(admin)/purchasing/runs/${order.runId}` as Href);
                      return;
                    }
                    if (onSelectOrder) {
                      onSelectOrder(order.id);
                      return;
                    }
                    router.push(`/(app)/(admin)/purchasing/${order.id}` as Href);
                  }}
                />
            ) : tab === 'fabric' ? (
              <OrderFabricGroupCard
                group={item as ReturnType<typeof groupFabricRowsBySalesOrder>[number]}
                surface="desk"
                showSupplier
                onPressOrder={
                  canReadOrder && (item as ReturnType<typeof groupFabricRowsBySalesOrder>[number]).salesOrderId
                    ? () =>
                        router.push(
                          `/(app)/(admin)/orders/${(item as ReturnType<typeof groupFabricRowsBySalesOrder>[number]).salesOrderId}` as Href,
                        )
                    : undefined
                }
                onPressFabric={(row) => router.push(fabricRowHref(row) as Href)}
              />
            ) : (
              <SupplierInvoiceBoardCard
                invoice={item as ReturnType<typeof selectSupplierInvoiceCard>}
                onPress={() =>
                  router.push(
                    `/(app)/(admin)/purchasing/supplier-invoices/${item.id}` as Href,
                  )
                }
              />
            )}
          </ListItemEnter>
        )}
      />

      <PurchasingSupplierSheet
        open={supplierSheetOpen}
        onClose={() => setSupplierSheetOpen(false)}
        suppliers={supplierOptions}
        selectedId={supplierId}
        openOrdersBySupplier={supplierOpenOrders}
        onConfirm={(s) => {
          setSupplierId(s?.id ?? null);
          setSupplierLabel(s?.name ?? null);
        }}
      />
      <PurchasingStatusFilterSheet
        open={statusSheetOpen}
        onClose={() => setStatusSheetOpen(false)}
        statuses={statusFiltersForTab(tab)}
        status={status}
        dateFrom={dateFrom}
        dateTo={dateTo}
        hideDates={tab === 'fabric'}
        warehouses={tab === 'orders' ? warehouseOptions : []}
        warehouseId={warehouseId}
        onApply={({ status: nextStatus, dateFrom: nextFrom, dateTo: nextTo, warehouseId: nextWarehouse }) => {
          setStatus(nextStatus);
          setDateFrom(nextFrom ?? '');
          setDateTo(nextTo ?? '');
          setWarehouseId(nextWarehouse);
          setWarehouseLabel(
            nextWarehouse
              ? warehouseOptions.find((w) => w.id === nextWarehouse)?.name ?? null
              : null,
          );
        }}
      />
    </AppScreen>
  );
}
