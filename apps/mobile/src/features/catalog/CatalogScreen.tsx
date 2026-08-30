import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerEmptyState, DealerProductCard } from '@/features/dealer-ui';
import { useLocale } from '@/i18n';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  DEALER_TAB_BAR_CLEARANCE,
  SURFACE_TAB_BAR_CLEARANCE,
} from '@/navigation/tabBarClearance';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import type { BrowseCategory, BrowseProduct } from './api';
import { CatalogFilterChips } from './components/CatalogFilterChips';
import {
  CatalogFilterSheet,
  countActiveCatalogFilters,
  defaultCatalogFilterDraft,
  type CatalogFilterDraft,
} from './components/CatalogFilterSheet';
import { CatalogGridSkeleton } from './components/CatalogGridSkeleton';
import { CatalogStoreChrome } from './components/CatalogStoreChrome';
import { CreateProductSheet } from './components/CreateProductSheet';
import { DealerCatalogChrome } from './components/DealerCatalogChrome';
import { DealerCatalogGridSkeleton } from './components/DealerCatalogGridSkeleton';
import { ProductCard } from './components/ProductCard';
import {
  flattenCatalogPages,
  useBrowseCategoriesQuery,
  useCatalogInfiniteQuery,
  useFavoriteProductsQuery,
  usePreviouslyOrderedQuery,
} from './query';
import { toProductCard } from './selectProductCard';
import { CATALOG_SEARCH_DEBOUNCE_MS } from './catalogSearchDebounce';
import { adminCatalogFabBottom, adminCatalogListBottomPad } from './catalogGridInsets';
import { type CatalogBrowseMode } from './catalogBrowseMode';
import { isCatalogPickForOrder } from './catalogPickForOrder';
import { navigateToNewOrderWithProduct } from './newOrderDeepLink';
import { useDealerFavorites } from './useDealerFavorites';
type CatalogScreenProps = {
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixtureProducts?: BrowseProduct[];
  fixtureCategories?: BrowseCategory[];
  /** Override product detail navigation (defaults to customer catalog). */
  productDetailHref?: (id: string) => Href;
  titleKey?: string;
  /** Show the brand return stamp (admin products hub, etc.). */
  showBack?: boolean;
  backFallback?: Href;
  /** Admin: show Add product when user has catalog.manage. */
  showCreateProduct?: boolean;
  /**
   * `dealer` — premium customer catalog (DealerProductCard, FAB clearance).
   * `admin` — shared products hub chrome (unchanged admin UX).
   */
  variant?: 'dealer' | 'admin';
};

export function CatalogScreen({
  forceState,
  fixtureProducts,
  fixtureCategories,
  productDetailHref,
  titleKey = 'mobile.catalog.title',
  showBack = false,
  backFallback = '/(app)/(admin)/(tabs)' as Href,
  showCreateProduct = false,
  variant = 'dealer',
}: CatalogScreenProps = {}) {
  const { user } = useAuth();
  const { t, formatCurrency, locale, isRTL } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const isDealer = variant === 'dealer';
  const pickForOrder = isDealer && isCatalogPickForOrder(searchParams);
  const allowed = can(user, 'catalog.read');
  const canCreate = showCreateProduct && can(user, 'catalog.manage');
  const addProductLabel = (() => {
    const v = t('catalog.addProduct');
    return v === 'catalog.addProduct' ? 'Add product' : v;
  })();
  const fabSize = 56;
  const tabClearance = isDealer ? DEALER_TAB_BAR_CLEARANCE : SURFACE_TAB_BAR_CLEARANCE;
  /** Admin grid: last row + chocolate + FAB must clear the floating tab (inset only). */
  const listBottomPad = isDealer
    ? theme.spacing['3xl'] + tabClearance
    : adminCatalogListBottomPad(
        insets.bottom,
        canCreate ? fabSize + theme.spacing.md : 0,
      );

  const [searchInput, setSearchInput] = useState('');
  const q = useDebouncedValue(searchInput.trim(), CATALOG_SEARCH_DEBOUNCE_MS);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [browseMode, setBrowseMode] = useState<CatalogBrowseMode>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogFilterDraft>(defaultCatalogFilterDraft);
  const [applied, setApplied] = useState<CatalogFilterDraft>(defaultCatalogFilterDraft);

  const favorites = useDealerFavorites(isDealer ? user?.id : undefined);

  const filters = {
    q: q || undefined,
    categoryId: categoryId || undefined,
    sortBy: applied.sortBy,
    sortDir: applied.sortDir,
  };

  const categoriesQuery = useBrowseCategoriesQuery(allowed && !forceState);
  const productsQuery = useCatalogInfiniteQuery(
    filters,
    allowed && !forceState && (!isDealer || browseMode === 'all'),
  );
  const orderedQuery = usePreviouslyOrderedQuery(isDealer && allowed && !forceState);
  const favoriteProductsQuery = useFavoriteProductsQuery(
    favorites.favoriteIds,
    isDealer && allowed && !forceState && browseMode === 'favorites' && favorites.ready,
  );

  /** Pull-to-refresh only — not filter / search transitions. */
  const pullRefreshing =
    browseMode === 'ordered'
      ? orderedQuery.isRefetching && !orderedQuery.isPending
      : browseMode === 'favorites'
        ? false
        : productsQuery.isRefetching &&
          !productsQuery.isFetchingNextPage &&
          !productsQuery.isPlaceholderData;

  /**
   * Filter/search/sort in flight while previous results still show
   * (keepPreviousData). Soft indicator — never swap the whole screen.
   */
  const isFilterUpdating =
    !forceState &&
    browseMode === 'all' &&
    productsQuery.isFetching &&
    !productsQuery.isFetchingNextPage &&
    Boolean(productsQuery.data);

  const liveProducts = flattenCatalogPages(productsQuery.data);
  const orderedProducts = orderedQuery.data ?? [];
  const orderedBadgeSet = useMemo(
    () => new Set(orderedProducts.map((p) => p.id)),
    [orderedProducts],
  );

  const cards = useMemo(() => {
    let products: BrowseProduct[] =
      forceState === 'success' || forceState === 'offline'
        ? (fixtureProducts ?? [])
        : forceState === 'empty'
          ? []
          : browseMode === 'ordered' && isDealer
            ? orderedProducts
            : browseMode === 'favorites' && isDealer
              ? favoriteProductsQuery.products
              : liveProducts;

    // Client search on ordered / favorites lists
    if (isDealer && browseMode !== 'all' && q) {
      const needle = q.toLowerCase();
      products = products.filter((p) => {
        const blob = `${p.nameEn} ${p.nameAr} ${p.nameHe ?? ''} ${p.sku}`.toLowerCase();
        return blob.includes(needle);
      });
    }

    return products.map((p) => toProductCard(p, locale));
  }, [
    forceState,
    fixtureProducts,
    liveProducts,
    orderedProducts,
    favoriteProductsQuery.products,
    locale,
    browseMode,
    isDealer,
    q,
  ]);

  const categories: BrowseCategory[] =
    forceState === 'success' || forceState === 'offline'
      ? (fixtureCategories ?? [])
      : forceState === 'empty'
        ? []
        : (categoriesQuery.data ?? []);

  const screenW = Dimensions.get('window').width;
  const pad = theme.spacing.lg;
  const gap = theme.spacing.md;
  const cardWidth = (screenW - pad * 2 - gap) / 2;
  const filterActiveCount = countActiveCatalogFilters(applied);

  /** True first visit only — never when swapping filters. */
  const isInitialLoading =
    forceState === 'loading' ||
    (allowed &&
      !forceState &&
      (browseMode === 'ordered'
        ? orderedQuery.isPending && !orderedQuery.data
        : browseMode === 'favorites'
          ? !favorites.ready ||
            (favorites.favoriteIds.length > 0 && favoriteProductsQuery.isPending)
          : productsQuery.isPending &&
            !productsQuery.data &&
            !productsQuery.isPlaceholderData));

  const onChipChange = (next: string | null) => {
    setCategoryId(next);
  };

  const GridSkeleton = isDealer ? DealerCatalogGridSkeleton : CatalogGridSkeleton;

  const openProduct = (id: string) => {
    if (pickForOrder) {
      void haptics.confirmMedium();
      navigateToNewOrderWithProduct(router, id, 1);
      return;
    }
    router.push(
      productDetailHref
        ? productDetailHref(id)
        : (`/(app)/(customer)/catalog/${id}` as Href),
    );
  };

  const emptyTitle =
    browseMode === 'favorites'
      ? t('mobile.catalog.favoritesEmptyTitle')
      : browseMode === 'ordered'
        ? t('mobile.catalog.orderedEmptyTitle')
        : t('mobile.catalog.emptyTitle');
  const emptyBody =
    browseMode === 'favorites'
      ? t('mobile.catalog.favoritesEmptyBody')
      : browseMode === 'ordered'
        ? t('mobile.catalog.orderedEmptyBody')
        : t('mobile.catalog.emptyBody');

  const pickBanner = pickForOrder ? (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.xl,
        backgroundColor: colors.brandSoft,
        borderWidth: 1,
        borderColor: colors.brand,
      }}
    >
      <Ionicons name="bag-handle-outline" size={20} color={colors.brand} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" weight="semibold" color="brand">
          {t('mobile.newOrder.pickFromCatalogTitle')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t('mobile.newOrder.pickFromCatalogBody')}
        </AppText>
      </View>
      <Pressable
        onPress={() => {
          void haptics.selection();
          router.navigate('/(app)/(customer)/(tabs)/new-order' as Href);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.newOrder.back')}
        hitSlop={8}
      >
        <AppText variant="caption" weight="semibold" color="brand">
          {t('mobile.newOrder.back')}
        </AppText>
      </Pressable>
    </View>
  ) : null;

  const chrome = isDealer ? (
    <DealerCatalogChrome
      titleKey={titleKey}
      searchInput={searchInput}
      onSearchChange={setSearchInput}
      filterActiveCount={filterActiveCount}
      onOpenFilters={() => {
        setDraft({ ...applied });
        setSheetOpen(true);
      }}
      categories={categories}
      categoryId={categoryId}
      onCategoryChange={onChipChange}
      browseMode={browseMode}
      onBrowseModeChange={setBrowseMode}
      showCategories={browseMode === 'all'}
    />
  ) : (
    <CatalogStoreChrome
      titleKey={titleKey}
      searchInput={searchInput}
      onSearchChange={setSearchInput}
      filterActiveCount={filterActiveCount}
      onOpenFilters={() => {
        setDraft({ ...applied });
        setSheetOpen(true);
      }}
      showBack={showBack}
      backFallback={backFallback}
    >
      <CatalogFilterChips
        categories={categories}
        value={categoryId}
        onChange={onChipChange}
      />
    </CatalogStoreChrome>
  );

  if (isInitialLoading) {
    return (
      <AppScreen>
        {chrome}
        <View style={{ paddingHorizontal: isDealer ? pad : 0, paddingTop: theme.spacing.sm }}>
          <GridSkeleton />
        </View>
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

  const listError =
    browseMode === 'ordered'
      ? orderedQuery.isError && !orderedQuery.data
      : productsQuery.isError && !productsQuery.data;

  if (forceState === 'error' || (listError && !forceState)) {
    return (
      <AppScreen backFallback={showBack ? backFallback : undefined}>
        <AppText variant="title" weight={titleWeight}>
          {t(titleKey)}
        </AppText>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingBottom: tabClearance,
          }}
        >
          <ErrorState
            title={t('mobile.catalog.errorTitle')}
            description={t('mobile.catalog.errorBody')}
            retryLabel={t('mobile.catalog.retry')}
            onRetry={() => {
              if (browseMode === 'ordered') void orderedQuery.refetch();
              else void productsQuery.refetch();
            }}
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        numColumns={2}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ paddingHorizontal: pad, paddingBottom: theme.spacing.sm, gap: theme.spacing.sm }}>
            {showOfflineBanner || forceState === 'offline' ? <OfflineBanner /> : null}
            {chrome}
            {pickBanner}
            {isFilterUpdating ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                }}
              >
                <ActivityIndicator size="small" color={colors.brand} />
              </View>
            ) : null}
          </View>
        }
        columnWrapperStyle={{
          gap,
          paddingHorizontal: pad,
          alignItems: 'flex-start',
        }}
        contentContainerStyle={{
          paddingBottom: listBottomPad,
          flexGrow: 1,
        }}
        style={{ opacity: isFilterUpdating ? 0.72 : 1 }}
        windowSize={7}
        maxToRenderPerBatch={8}
        initialNumToRender={6}
        removeClippedSubviews
        refreshControl={
          forceState ? undefined : (
            <RefreshControl
              refreshing={pullRefreshing}
              onRefresh={() => {
                if (browseMode === 'ordered') {
                  void orderedQuery.refetch();
                } else if (browseMode === 'favorites') {
                  void favoriteProductsQuery.refetch();
                } else {
                  void productsQuery.refetch();
                }
                void categoriesQuery.refetch();
                void orderedQuery.refetch();
              }}
              tintColor={colors.brand}
            />
          )
        }
        onEndReached={() => {
          if (
            !forceState &&
            browseMode === 'all' &&
            productsQuery.hasNextPage &&
            !productsQuery.isFetchingNextPage
          ) {
            void productsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          isFilterUpdating ? (
            <View style={{ paddingHorizontal: pad, paddingTop: theme.spacing.md }}>
              <GridSkeleton />
            </View>
          ) : isDealer ? (
            <DealerEmptyState title={emptyTitle} body={emptyBody} />
          ) : (
            <EmptyState title={emptyTitle} description={emptyBody} />
          )
        }
        ListFooterComponent={
          browseMode === 'all' && productsQuery.isFetchingNextPage ? (
            <View style={{ paddingVertical: theme.spacing.lg, paddingHorizontal: pad }}>
              <GridSkeleton />
            </View>
          ) : null
        }
        renderItem={({ item, index }) =>
          isDealer ? (
            <DealerProductCard
              title={item.name}
              priceLabel={item.price != null ? formatCurrency(item.price) : undefined}
              categoryLabel={item.categoryName}
              imageUri={item.imageUrl}
              width={cardWidth}
              index={index}
              favorited={favorites.isFavorite(item.id)}
              orderedBefore={orderedBadgeSet.has(item.id)}
              onToggleFavorite={() => favorites.toggleFavorite(item.id)}
              onPress={() => openProduct(item.id)}
            />
          ) : (
            <ProductCard
              product={item}
              index={index}
              width={cardWidth}
              onPress={() => openProduct(item.id)}
            />
          )
        }
      />
      <CatalogFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        draft={draft}
        onChange={setDraft}
        onReset={() => {
          setDraft(defaultCatalogFilterDraft);
          setApplied(defaultCatalogFilterDraft);
          setSheetOpen(false);
        }}
        onApply={() => {
          setApplied(draft);
          setSheetOpen(false);
        }}
      />
      {canCreate ? (
        <>
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              zIndex: 40,
            }}
          >
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={addProductLabel}
              onPress={() => {
                void haptics.selection();
                setCreateOpen(true);
              }}
              style={{
                position: 'absolute',
                bottom: adminCatalogFabBottom(insets.bottom),
                ...(isRTL ? { left: theme.spacing.lg } : { right: theme.spacing.lg }),
                width: fabSize,
                height: fabSize,
                borderRadius: fabSize / 2,
                backgroundColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <Ionicons name="add" size={28} color={colors.onBrand} />
            </AnimatedPressable>
          </View>
          <CreateProductSheet
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            initialCategoryId={categoryId}
            onCreated={(id) => {
              if (productDetailHref) {
                router.push(productDetailHref(id));
              }
            }}
          />
        </>
      ) : null}
    </AppScreen>
  );
}
