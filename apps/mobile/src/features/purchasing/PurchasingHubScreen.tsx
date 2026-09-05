import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { listLowStock, listWarehouses } from '@/api/modules/inventory';
import { queryKeys } from '@/api/queryKeys';
import type { MaterialDemandRow } from '@/api/modules/purchasing';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useMaterialDemandQuery } from '@/features/inventory/query';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { surfaceListBottomInset } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { CreatePurchaseOrderSheet } from './components/CreatePurchaseOrderSheet';
import { CreatePurchaseRequestSheet } from './components/CreatePurchaseRequestSheet';
import { NeedsToBuyBoard } from './components/NeedsToBuyBoard';
import { PurchaseOrderBoardCard } from './components/PurchaseOrderBoardCard';
import { PurchaseRequestBoardCard } from './components/PurchaseRequestBoardCard';
import { OrderFabricGroupCard } from '@/features/fabric/OrderFabricGroupCard';
import {
  filterFabricRowsByPurchasingStatus,
  groupFabricRowsBySalesOrder,
  selectFabricTrackerRows,
} from '@/features/fabric/selectFabricTracker';
import { PurchasingFilterTriggers, PURCHASING_CHROME_CONTROL_H, PURCHASING_CHROME_GAP } from './components/PurchasingFilterTriggers';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { PurchasingHeroActions } from './components/PurchasingHeroActions';
import { PurchasingStatusFilterSheet } from './components/PurchasingStatusFilterSheet';
import { PurchasingSupplierSheet } from './components/PurchasingSupplierSheet';
import { PurchasingTabBar } from './components/PurchasingTabBar';
import { SupplierInvoiceBoardCard } from './components/SupplierInvoiceBoardCard';
import {
  isStatusFilterActive,
  statusFiltersForTab,
  type PurchasingHubTab,
  type PurchasingSupplierOption,
} from './purchasingFilters';
import {
  flattenPurchaseOrders,
  flattenPurchaseRequests,
  flattenSupplierInvoices,
  useFromLowStockMutation,
  usePurchaseOrdersInfiniteQuery,
  usePurchaseRequestsInfiniteQuery,
  useSupplierInvoicesInfiniteQuery,
  useSuppliersQuery,
  useFabricProcurementsQuery,
} from './query';
import {
  incomingQtyFromOrders,
  needsToBuyDraftLine,
  selectNeedsToBuyItem,
  selectPurchaseCard,
  selectPurchaseRequestCard,
  selectSupplierInvoiceCard,
  type DraftMaterialLine,
} from './selectPurchase';

const LIST_BOTTOM_EXTRA = 48;

type NeedsCartEntry = {
  inventoryItemId: string;
  sku: string;
  description: string;
  unit: string;
  stillNeeded: number;
  standardCost: number;
};

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

export function PurchasingHubScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/(tabs)' as Href;

  const canPo = can(user, 'purchase-order.read');
  const canPr = can(user, 'purchase-request.read');
  const canSi = can(user, 'supplier-invoice.read');
  const canCreatePo = can(user, 'purchase-order.create');
  const canCreatePr = can(user, 'purchase-request.create');
  const canReadSupplier = can(user, 'supplier.read');
  const canInventory = can(user, 'inventory.read');
  const canFabric = can(user, 'fabric.procurement.read');
  const canReadOrder = can(user, 'sales-order.read');

  const routeParams = useLocalSearchParams<{
    tab?: string;
    focus?: string;
    needs?: string;
    arriving?: string;
    late?: string;
  }>();

  const initialTab: PurchasingHubTab = (() => {
    const raw = String(routeParams.tab ?? '').trim();
    if (raw === 'orders' || raw === 'requests' || raw === 'invoices' || raw === 'fabric') {
      return raw;
    }
    if (routeParams.needs || routeParams.arriving || routeParams.late === 'true' || routeParams.focus === 'needs') {
      return canPo ? 'orders' : canPr ? 'requests' : canFabric ? 'fabric' : 'invoices';
    }
    return canPo ? 'orders' : canPr ? 'requests' : canFabric ? 'fabric' : 'invoices';
  })();
  const [tab, setTab] = useState<PurchasingHubTab>(initialTab);
  // Deep links land on an already-mounted hub, so re-sync when ?tab= changes.
  const requestedTab = String(routeParams.tab ?? '').trim();
  useEffect(() => {
    if (
      requestedTab === 'orders' ||
      requestedTab === 'requests' ||
      requestedTab === 'invoices' ||
      requestedTab === 'fabric'
    ) {
      setTab(requestedTab);
      setStatus('ALL');
    }
  }, [requestedTab]);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierLabel, setSupplierLabel] = useState<string | null>(null);

  const [supplierSheetOpen, setSupplierSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [createPoOpen, setCreatePoOpen] = useState(false);
  const [createPoInitialLines, setCreatePoInitialLines] = useState<DraftMaterialLine[] | undefined>();
  const [createPrOpen, setCreatePrOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [needsCart, setNeedsCart] = useState<Record<string, NeedsCartEntry>>({});

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
    dateFrom: dateFrom.trim() || undefined,
    dateTo: dateTo.trim() || undefined,
  };

  const needsCartCount = Object.keys(needsCart).length;
  const needsCartLines = useMemo((): DraftMaterialLine[] => {
    return Object.values(needsCart).map((entry) => ({
      key: `need-${entry.inventoryItemId}`,
      inventoryItemId: entry.inventoryItemId,
      description: entry.description,
      unit: entry.unit,
      quantity: String(entry.stillNeeded),
      unitCost: String(entry.standardCost || 0),
    }));
  }, [needsCart]);

  const addNeedToCart = (row: MaterialDemandRow) => {
    const stillNeeded = Number(row.stillNeeded);
    if (!(stillNeeded > 0)) return;
    const description =
      locale === 'ar'
        ? row.nameAr || row.nameEn || row.sku
        : locale === 'he'
          ? row.nameHe || row.nameEn || row.nameAr || row.sku
          : row.nameEn || row.nameAr || row.sku;
    const cost = Number(row.standardCost);
    void haptics.selection();
    setNeedsCart((prev) => {
      const existing = prev[row.inventoryItemId];
      const nextQty = (existing?.stillNeeded ?? 0) + stillNeeded;
      return {
        ...prev,
        [row.inventoryItemId]: {
          inventoryItemId: row.inventoryItemId,
          sku: row.sku,
          description,
          unit: row.unit || 'pcs',
          stillNeeded: nextQty,
          standardCost: Number.isFinite(cost) ? cost : existing?.standardCost ?? 0,
        },
      };
    });
  };

  const openCreateFromNeeds = () => {
    if (needsCartLines.length === 0) return;
    void haptics.confirmLight();
    setCreatePoInitialLines(needsCartLines);
    setCreatePoOpen(true);
  };

  const poQuery = usePurchaseOrdersInfiniteQuery(filters, canPo);
  const prQuery = usePurchaseRequestsInfiniteQuery(filters, canPr);
  const siQuery = useSupplierInvoicesInfiniteQuery(filters, canSi);
  const fabricQuery = useFabricProcurementsQuery(
    { q: q || undefined, state: status === 'ALL' || status === 'ARRIVED' || status === 'PARTIAL' ? undefined : status },
    canFabric && tab === 'fabric',
  );
  const suppliersQuery = useSuppliersQuery(canPo || canPr || canSi);
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-purchasing-hub'],
    queryFn: listWarehouses,
    enabled: canPo,
  });
  const lowStockQuery = useQuery({
    queryKey: queryKeys.inventory.lowStock(),
    queryFn: listLowStock,
    enabled: canPo && canInventory,
  });
  const fromLowStock = useFromLowStockMutation();
  const demandQuery = useMaterialDemandQuery(canPo);

  const shortageNeeds = useMemo(() => {
    const rows = demandQuery.data ?? [];
    return rows
      .filter((r) => Number(r.stillNeeded) > 0)
      .slice(0, 5);
  }, [demandQuery.data]);

  const supplierOpenOrders = useMemo(() => {
    const map = new Map<string, Array<{ id: string; number: string; status: string }>>();
    for (const po of flattenPurchaseOrders(poQuery.data)) {
      if (!po.supplierId) continue;
      const open =
        po.status !== 'CLOSED' &&
        po.status !== 'CANCELLED' &&
        po.status !== 'RECEIVED';
      if (!open) continue;
      const list = map.get(po.supplierId) ?? [];
      list.push({ id: po.id, number: po.number, status: po.status });
      map.set(po.supplierId, list);
    }
    return map;
  }, [poQuery.data]);

  const warehouseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehousesQuery.data ?? []) {
      const name =
        locale === 'ar'
          ? w.nameAr || w.nameEn || w.code
          : w.nameEn || w.nameAr || w.code;
      map.set(w.id, name);
    }
    return map;
  }, [warehousesQuery.data, locale]);

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

  const poRows = useMemo(() => flattenPurchaseOrders(poQuery.data), [poQuery.data]);
  const poCards = useMemo(
    () =>
      poRows.map((po) =>
        selectPurchaseCard(
          po,
          locale,
          po.warehouseId ? warehouseNameById.get(po.warehouseId) : null,
        ),
      ),
    [poRows, locale, warehouseNameById],
  );
  const needsToBuy = useMemo(() => {
    return (lowStockQuery.data ?? []).slice(0, 8).map((item) =>
      selectNeedsToBuyItem(item, locale, incomingQtyFromOrders(item.id, poRows)),
    );
  }, [lowStockQuery.data, locale, poRows]);
  const prCards = useMemo(
    () =>
      flattenPurchaseRequests(prQuery.data).map((pr) =>
        selectPurchaseRequestCard(pr, locale),
      ),
    [prQuery.data, locale],
  );
  const siCards = useMemo(
    () =>
      flattenSupplierInvoices(siQuery.data).map((inv) =>
        selectSupplierInvoiceCard(inv, locale),
      ),
    [siQuery.data, locale],
  );
  const fabricRows = useMemo(() => {
    const rows = selectFabricTrackerRows(fabricQuery.data ?? []);
    return filterFabricRowsByPurchasingStatus(rows, status);
  }, [fabricQuery.data, status]);
  const fabricGroups = useMemo(() => groupFabricRowsBySalesOrder(fabricRows), [fabricRows]);

  const activeQuery =
    tab === 'orders' ? poQuery : tab === 'requests' ? prQuery : tab === 'fabric' ? fabricQuery : siQuery;
  const listData =
    tab === 'orders' ? poCards : tab === 'requests' ? prCards : tab === 'fabric' ? fabricGroups : siCards;

  const poCount = poQuery.data?.pages[0]?.meta?.totalItems;
  const prCount = prQuery.data?.pages[0]?.meta?.totalItems;
  const siCount = siQuery.data?.pages[0]?.meta?.totalItems;

  const statusLabel = isStatusFilterActive(status)
    ? (() => {
        const key = `statuses.${status}`;
        const translated = t(key);
        return translated === key ? status : translated;
      })()
    : t('mobile.purchasing.filter');
  const filterActive = isStatusFilterActive(status) || Boolean(dateFrom || dateTo);

  const searchPlaceholder =
    tab === 'orders'
      ? t('mobile.purchasing.searchOrders')
      : tab === 'requests'
        ? t('mobile.purchasing.searchRequests')
        : tab === 'fabric'
          ? t('mobile.purchasing.searchFabric')
          : t('mobile.purchasing.searchInvoices');

  const supplierChipLabel = t('mobile.purchasing.suppliers');

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
      show: canPo,
      count: typeof poCount === 'number' ? poCount : undefined,
    },
    {
      key: 'requests',
      label: t('catalog.purchaseRequests'),
      show: canPr,
      count: typeof prCount === 'number' ? prCount : undefined,
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
              height: theme.spacing['3xl'] + LIST_BOTTOM_EXTRA + surfaceListBottomInset(insets.bottom),
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
              canCreatePr={canCreatePr}
              canCreatePo={canCreatePo}
              fromLowStockLoading={fromLowStock.isPending}
              onFromLowStock={() => {
                fromLowStock.mutate(undefined, {
                  onSuccess: (pr) => {
                    void haptics.confirmLight();
                    showToast({
                      variant: 'success',
                      message: t('catalog.prFromLowStockCreated'),
                    });
                    router.push(`/(app)/(admin)/purchasing/requests/${pr.id}` as Href);
                  },
                  onError: (err) => {
                    void haptics.error();
                    showToast({
                      variant: 'error',
                      message: isApiError(err)
                        ? toastMessageForError(err)
                        : t('mobile.purchasing.createFailed'),
                    });
                  },
                });
              }}
              onNewRequest={() => setCreatePrOpen(true)}
              onNewOrder={() => {
                setCreatePoInitialLines(undefined);
                setCreatePoOpen(true);
              }}
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
                : tab === 'requests'
                  ? t('mobile.purchasing.tabRequestsHint')
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
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'stretch',
                  gap: PURCHASING_CHROME_GAP,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
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
                </View>
                {canReadSupplier ? (
                  <AnimatedPressable
                    variant="button"
                    accessibilityRole="button"
                    accessibilityLabel={t('mobile.purchasing.suppliers')}
                    onPress={() => {
                      void haptics.selection();
                      router.push('/(app)/(admin)/purchasing/suppliers' as Href);
                    }}
                    style={{
                      height: PURCHASING_CHROME_CONTROL_H,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.full,
                      borderWidth: 1.5,
                      borderColor: colors.brand,
                      backgroundColor: colors.brandSoft,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      ...orderBoardShadow(colorScheme),
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.brand,
                      }}
                    >
                      <Ionicons name="people-outline" size={16} color={colors.brand} />
                    </View>
                    <AppText
                      variant="caption"
                      weight={titleWeight}
                      style={{ color: colors.brand, fontSize: 13, lineHeight: 16 }}
                      numberOfLines={1}
                    >
                      {supplierChipLabel}
                    </AppText>
                  </AnimatedPressable>
                ) : null}
              </View>
              <PurchasingFilterTriggers
                supplierLabel={supplierLabel}
                onOpenSuppliers={() => setSupplierSheetOpen(true)}
                onClearSupplier={() => {
                  setSupplierId(null);
                  setSupplierLabel(null);
                }}
                statusActive={filterActive}
                statusLabel={statusLabel}
                onOpenStatus={() => setStatusSheetOpen(true)}
              />
            </View>

            {canPo && tab !== 'fabric' && shortageNeeds.length > 0 ? (
              <PurchasingFloorBoard title={t('mobile.purchasing.needsToBuy')}>
                {shortageNeeds.map((row) => {
                  const name =
                    locale === 'ar'
                      ? row.nameAr || row.nameEn || row.sku
                      : locale === 'he'
                        ? row.nameHe || row.nameEn || row.nameAr || row.sku
                        : row.nameEn || row.nameAr || row.sku;
                  const inCart = Boolean(needsCart[row.inventoryItemId]);
                  return (
                    <AnimatedPressable
                      key={row.inventoryItemId}
                      variant="button"
                      accessibilityRole="button"
                      accessibilityLabel={t('mobile.purchasing.addToPurchase')}
                      disabled={!canCreatePo}
                      onPress={() => {
                        if (!canCreatePo) return;
                        addNeedToCart(row);
                      }}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        justifyContent: 'space-between',
                        gap: theme.spacing.sm,
                        alignItems: 'center',
                        paddingVertical: theme.spacing.xs,
                        borderRadius: theme.radius.lg,
                        borderWidth: inCart ? 1 : 0,
                        borderColor: inCart ? colors.brand : 'transparent',
                        paddingHorizontal: inCart ? theme.spacing.sm : 0,
                        backgroundColor: inCart ? colors.brandSoft : 'transparent',
                      }}
                    >
                      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                        <AppText
                          weight="semibold"
                          numberOfLines={1}
                          style={{ textAlign: isRTL ? 'right' : 'left' }}
                        >
                          {name}
                        </AppText>
                        <AppText
                          variant="caption"
                          color="muted"
                          dir="ltr"
                          style={{ textAlign: isRTL ? 'right' : 'left' }}
                        >
                          {row.sku}
                        </AppText>
                        {canCreatePo ? (
                          <AppText
                            variant="caption"
                            weight="semibold"
                            style={{
                              color: colors.brand,
                              textAlign: isRTL ? 'right' : 'left',
                              fontSize: 11,
                            }}
                          >
                            {t('mobile.purchasing.addToPurchase')}
                          </AppText>
                        ) : null}
                      </View>
                      <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end', gap: 2 }}>
                        <AppText weight="semibold" dir="ltr" style={{ color: colors.error }}>
                          {`${Number(row.stillNeeded)} ${row.unit || ''}`.trim()}
                        </AppText>
                        <AppText variant="caption" color="muted" dir="ltr">
                          {`${t('mobile.purchasing.incoming')}: ${Number(row.incomingQty ?? 0)}`}
                        </AppText>
                      </View>
                    </AnimatedPressable>
                  );
                })}
                {canCreatePo && needsCartCount > 0 ? (
                  <PrimaryButton
                    label={`${t('mobile.purchasing.createFromNeeds')} (${needsCartCount})`}
                    onPress={openCreateFromNeeds}
                    style={{ borderRadius: theme.radius.xl, marginTop: theme.spacing.xs }}
                  />
                ) : null}
              </PurchasingFloorBoard>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              q
                ? t('mobile.purchasing.emptySearchTitle')
                : tab === 'orders'
                  ? t('catalog.noPurchaseOrders')
                  : tab === 'requests'
                    ? t('catalog.noPurchaseRequests')
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
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            {tab === 'orders' ? (
              <PurchaseOrderBoardCard
                order={item as ReturnType<typeof selectPurchaseCard>}
                onPress={() =>
                  router.push(`/(app)/(admin)/purchasing/${item.id}` as Href)
                }
              />
            ) : tab === 'requests' ? (
              <PurchaseRequestBoardCard
                request={item as ReturnType<typeof selectPurchaseRequestCard>}
                onPress={() =>
                  router.push(`/(app)/(admin)/purchasing/requests/${item.id}` as Href)
                }
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
                onPressFabric={(row) =>
                  router.push(`/(app)/(admin)/purchasing/fabric/${row.id}` as Href)
                }
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
        onApply={({ status: nextStatus, dateFrom: nextFrom, dateTo: nextTo }) => {
          setStatus(nextStatus);
          setDateFrom(nextFrom ?? '');
          setDateTo(nextTo ?? '');
        }}
      />
      {canCreatePo ? (
        <CreatePurchaseOrderSheet
          open={createPoOpen}
          onClose={() => {
            setCreatePoOpen(false);
            setCreatePoInitialLines(undefined);
          }}
          initialLines={createPoInitialLines}
          onCreated={(id) => {
            setNeedsCart({});
            setCreatePoInitialLines(undefined);
            router.push(`/(app)/(admin)/purchasing/${id}` as Href);
          }}
        />
      ) : null}
      {canCreatePr ? (
        <CreatePurchaseRequestSheet
          open={createPrOpen}
          onClose={() => setCreatePrOpen(false)}
          onCreated={(id) =>
            router.push(`/(app)/(admin)/purchasing/requests/${id}` as Href)
          }
        />
      ) : null}
    </AppScreen>
  );
}
