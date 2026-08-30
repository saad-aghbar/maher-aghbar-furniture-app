import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { listLowStock, listWarehouses } from '@/api/modules/inventory';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { surfaceListBottomInset } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { CreatePurchaseOrderSheet } from './components/CreatePurchaseOrderSheet';
import { CreatePurchaseRequestSheet } from './components/CreatePurchaseRequestSheet';
import { CreateSupplierSheet } from './components/CreateSupplierSheet';
import { NeedsToBuyBoard } from './components/NeedsToBuyBoard';
import { PurchaseOrderBoardCard } from './components/PurchaseOrderBoardCard';
import { PurchaseRequestBoardCard } from './components/PurchaseRequestBoardCard';
import { PurchasingFilterTriggers, PURCHASING_CHROME_CONTROL_H, PURCHASING_CHROME_GAP } from './components/PurchasingFilterTriggers';
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

/** Extra clearance under the list so the last cards clear the floating tab bar. */
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
  const canManageSupplier = can(user, 'supplier.manage');
  const canInventory = can(user, 'inventory.read');

  const initialTab: PurchasingHubTab = canPo ? 'orders' : canPr ? 'requests' : 'invoices';
  const [tab, setTab] = useState<PurchasingHubTab>(initialTab);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierLabel, setSupplierLabel] = useState<string | null>(null);

  const [supplierSheetOpen, setSupplierSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [createPoOpen, setCreatePoOpen] = useState(false);
  const [createPrOpen, setCreatePrOpen] = useState(false);
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  const [poSeedLines, setPoSeedLines] = useState<DraftMaterialLine[]>([]);

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
  };

  const poQuery = usePurchaseOrdersInfiniteQuery(filters, canPo);
  const prQuery = usePurchaseRequestsInfiniteQuery(filters, canPr);
  const siQuery = useSupplierInvoicesInfiniteQuery(filters, canSi);
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

  const activeQuery =
    tab === 'orders' ? poQuery : tab === 'requests' ? prQuery : siQuery;
  const listData =
    tab === 'orders' ? poCards : tab === 'requests' ? prCards : siCards;

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

  const searchPlaceholder =
    tab === 'orders'
      ? t('mobile.purchasing.searchOrders')
      : tab === 'requests'
        ? t('mobile.purchasing.searchRequests')
        : t('mobile.purchasing.searchInvoices');

  const supplierChipRaw = t('mobile.purchasing.newSupplierShort');
  const supplierChipLabel =
    supplierChipRaw !== 'mobile.purchasing.newSupplierShort'
      ? supplierChipRaw
      : t('catalog.newSupplier') !== 'catalog.newSupplier'
        ? t('catalog.newSupplier')
        : 'Supplier';

  if (!canPo && !canPr && !canSi) {
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
  ];

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={listData as Array<{ id: string }>}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom:
            theme.spacing['3xl'] + LIST_BOTTOM_EXTRA + surfaceListBottomInset(insets.bottom),
        }}
        refreshControl={
          <RefreshControl
            refreshing={activeQuery.isRefetching && !activeQuery.isFetchingNextPage}
            onRefresh={() => void activeQuery.refetch()}
            tintColor={colors.brand}
          />
        }
        onEndReached={() => {
          if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
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
                setPoSeedLines([]);
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
                {canManageSupplier ? (
                  <AnimatedPressable
                    variant="button"
                    accessibilityRole="button"
                    accessibilityLabel={t('catalog.newSupplier')}
                    onPress={() => {
                      void haptics.selection();
                      setCreateSupplierOpen(true);
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
                      <Ionicons name="add" size={16} color={colors.brand} />
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
                statusActive={isStatusFilterActive(status)}
                statusLabel={statusLabel}
                onOpenStatus={() => setStatusSheetOpen(true)}
              />
            </View>

            {tab === 'orders' && needsToBuy.length > 0 ? (
              <NeedsToBuyBoard
                items={needsToBuy}
                canAdd={canCreatePo}
                onAddToPurchase={(item) => {
                  setPoSeedLines([needsToBuyDraftLine(item)]);
                  setCreatePoOpen(true);
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              tab === 'orders'
                ? t('catalog.noPurchaseOrders')
                : tab === 'requests'
                  ? t('catalog.noPurchaseRequests')
                  : t('catalog.noSupplierInvoices')
            }
            description={t('mobile.purchasing.emptyBody')}
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
        onApply={setStatus}
      />
      {canCreatePo ? (
        <CreatePurchaseOrderSheet
          open={createPoOpen}
          onClose={() => setCreatePoOpen(false)}
          onCreated={(id) => router.push(`/(app)/(admin)/purchasing/${id}` as Href)}
          seedLines={poSeedLines}
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
      {canManageSupplier ? (
        <CreateSupplierSheet
          open={createSupplierOpen}
          onClose={() => setCreateSupplierOpen(false)}
        />
      ) : null}
    </AppScreen>
  );
}
