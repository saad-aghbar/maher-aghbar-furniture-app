import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
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
import { ProductCard } from './components/ProductCard';
import {
  catalogCategoriesFixture,
  catalogProductsFixture,
} from './fixtures';
import {
  flattenCatalogPages,
  useBrowseCategoriesQuery,
  useCatalogInfiniteQuery,
} from './query';
import { toProductCard } from './selectProductCard';

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
}: CatalogScreenProps = {}) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const allowed = can(user, 'catalog.read');
  const canCreate = showCreateProduct && can(user, 'catalog.manage');
  const addProductLabel = (() => {
    const v = t('catalog.addProduct');
    return v === 'catalog.addProduct' ? 'Add product' : v;
  })();
  const fabSize = 56;

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogFilterDraft>(defaultCatalogFilterDraft);
  const [applied, setApplied] = useState<CatalogFilterDraft>(defaultCatalogFilterDraft);

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filters = {
    q: q || undefined,
    categoryId: categoryId || undefined,
    sortBy: applied.sortBy,
    sortDir: applied.sortDir,
  };

  const categoriesQuery = useBrowseCategoriesQuery(allowed && !forceState);
  const productsQuery = useCatalogInfiniteQuery(filters, allowed && !forceState);

  /** Pull-to-refresh only — not filter / search transitions. */
  const pullRefreshing =
    productsQuery.isRefetching &&
    !productsQuery.isFetchingNextPage &&
    !productsQuery.isPlaceholderData;

  /**
   * Filter/search/sort in flight while previous results still show
   * (keepPreviousData). Soft indicator — never swap the whole screen.
   */
  const isFilterUpdating =
    !forceState &&
    productsQuery.isFetching &&
    !productsQuery.isFetchingNextPage &&
    Boolean(productsQuery.data);

  const liveProducts = flattenCatalogPages(productsQuery.data);

  const cards = useMemo(() => {
    const products: BrowseProduct[] =
      forceState === 'success' || forceState === 'offline'
        ? (fixtureProducts ?? catalogProductsFixture)
        : forceState === 'empty'
          ? []
          : liveProducts;
    return products.map((p) => toProductCard(p, locale));
  }, [forceState, fixtureProducts, liveProducts, locale]);

  const categories: BrowseCategory[] =
    forceState === 'success' || forceState === 'offline' || forceState === 'empty'
      ? (fixtureCategories ?? catalogCategoriesFixture)
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
      productsQuery.isPending &&
      !productsQuery.data &&
      !productsQuery.isPlaceholderData);

  const onChipChange = (next: string | null) => {
    setCategoryId(next);
  };

  const chrome = (
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
        <CatalogGridSkeleton />
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

  if (forceState === 'error' || (productsQuery.isError && !productsQuery.data && !forceState)) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        {chrome}
        <ErrorState
          title={t('mobile.catalog.errorTitle')}
          description={t('mobile.catalog.errorBody')}
          retryLabel={t('mobile.catalog.retry')}
          onRetry={() => void productsQuery.refetch()}
        />
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
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
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
                void productsQuery.refetch();
                void categoriesQuery.refetch();
              }}
              tintColor={colors.brand}
            />
          )
        }
        onEndReached={() => {
          if (!forceState && productsQuery.hasNextPage && !productsQuery.isFetchingNextPage) {
            void productsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          isFilterUpdating ? (
            <View style={{ paddingHorizontal: pad, paddingTop: theme.spacing.md }}>
              <CatalogGridSkeleton />
            </View>
          ) : (
            <EmptyState
              title={t('mobile.catalog.emptyTitle')}
              description={t('mobile.catalog.emptyBody')}
            />
          )
        }
        ListFooterComponent={
          productsQuery.isFetchingNextPage ? (
            <View style={{ paddingVertical: theme.spacing.lg, paddingHorizontal: pad }}>
              <CatalogGridSkeleton />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <ProductCard
            product={item}
            index={index}
            width={cardWidth}
            onPress={() => {
              router.push(
                productDetailHref
                  ? productDetailHref(item.id)
                  : (`/(app)/(customer)/catalog/${item.id}` as Href),
              );
            }}
          />
        )}
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
                bottom: SURFACE_TAB_BAR_CLEARANCE + theme.spacing.sm,
                right: theme.spacing.lg,
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
