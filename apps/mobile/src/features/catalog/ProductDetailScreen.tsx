import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { BackButton } from '@/components/BackButton';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { FadeIn, haptics, ListItemEnter } from '@/motion';
import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import type { BrowseProduct } from './api';
import { ProductDetailSkeleton } from './components/ProductDetailSkeleton';
import { ProductImageCarousel } from './components/ProductImageCarousel';
import { RelatedProductsRail } from './components/RelatedProductsRail';
import { catalogProductsFixture } from './fixtures';
import { navigateToNewOrderWithProduct } from './newOrderDeepLink';
import { useBrowseProductQuery, usePreviouslyOrderedQuery } from './query';
import {
  selectProductDetail,
  type ProductDetailDimension,
} from './selectProductDetail';
import { useDealerFavorites } from './useDealerFavorites';

type ProductDetailScreenProps = {
  productId: string;
  forceState?: 'loading' | 'error' | 'offline' | 'success';
  fixture?: BrowseProduct;
  /**
   * `dealer` — sticky Create Order + related rail.
   * `admin` — read-only browse fallback (no request CTA).
   */
  variant?: 'dealer' | 'admin';
  productDetailHref?: (id: string) => Href;
};

const DIM_ICON: Record<ProductDetailDimension['kind'], keyof typeof Ionicons.glyphMap> = {
  w: 'resize-outline',
  h: 'arrow-up-outline',
  d: 'git-commit-outline',
  seat: 'cafe-outline',
  custom: 'options-outline',
};

/**
 * Dealer PDP — gallery, dealer price, specs, measurements, sticky Order CTA
 * cleared above the persistent floating tab bar.
 */
export function ProductDetailScreen({
  productId,
  forceState,
  fixture,
  variant = 'dealer',
  productDetailHref,
}: ProductDetailScreenProps) {
  const { user } = useAuth();
  const { t, formatCurrency, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const allowed = can(user, 'catalog.read');
  const canCreate = can(user, 'request.create');
  const isDealer = variant === 'dealer';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dark = colorScheme === 'dark';

  const [qty, setQty] = useState(1);
  const query = useBrowseProductQuery(productId, allowed && !forceState);
  const refreshing = query.isRefetching && !query.isLoading;
  const favorites = useDealerFavorites(isDealer ? user?.id : undefined);
  const orderedQuery = usePreviouslyOrderedQuery(isDealer && allowed && !forceState);
  const orderedBefore =
    isDealer && (orderedQuery.data ?? []).some((p) => p.id === productId);

  const raw: BrowseProduct | undefined =
    forceState === 'success' || forceState === 'offline'
      ? (fixture ??
        catalogProductsFixture.find((p) => p.id === productId) ??
        catalogProductsFixture[0])
      : query.data;

  const vm = raw ? selectProductDetail(raw, locale) : null;

  const showOrderCta = isDealer && (canCreate || Boolean(forceState));
  /** Persistent tab bar + FAB never unmount — footer must clear them. */
  const footerClearance = isDealer
    ? DEALER_TAB_BAR_CLEARANCE + theme.spacing.sm
    : Math.max(insets.bottom, theme.spacing.md);
  const footerInnerH = 118;
  const scrollBottomPad = showOrderCta
    ? footerInnerH + footerClearance + theme.spacing.lg
    : 40 + Math.max(insets.bottom, theme.spacing.md);

  const lineTotal = useMemo(() => {
    if (vm?.price == null) return null;
    return vm.price * qty;
  }, [vm?.price, qty]);

  if (forceState === 'loading' || (allowed && query.isLoading && !query.data && !forceState)) {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <ProductDetailSkeleton />
      </AppScreen>
    );
  }

  if (!allowed && !forceState) {
    return (
      <AppScreen>
        <DetailNav onBack={() => router.back()} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (forceState === 'error' || (query.isError && !query.data && !forceState)) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <DetailNav onBack={() => router.back()} />
        <ErrorState
          title={t('mobile.productDetail.errorTitle')}
          description={t('mobile.productDetail.errorBody')}
          retryLabel={t('mobile.productDetail.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!vm) {
    return (
      <AppScreen>
        <DetailNav onBack={() => router.back()} />
        <EmptyState
          title={t('mobile.productDetail.errorTitle')}
          description={t('mobile.productDetail.errorBody')}
        />
      </AppScreen>
    );
  }

  const onCreateOrder = () => {
    void haptics.confirmMedium();
    navigateToNewOrderWithProduct(router, vm.id, qty);
  };

  const bumpQty = (delta: number) => {
    void haptics.selection();
    setQty((q) => Math.max(1, Math.min(99, q + delta)));
  };

  const cardLift = {
    ...theme.elevation.rest,
    shadowOpacity: dark ? 0.4 : 0.1,
    elevation: Platform.OS === 'android' ? 3 : theme.elevation.rest.elevation,
  } as const;

  return (
    <AppScreen edges={{ top: false, bottom: false }} style={{ paddingHorizontal: 0 }}>
      {showOfflineBanner || forceState === 'offline' ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 48,
            left: theme.spacing.lg,
            right: theme.spacing.lg,
            zIndex: 5,
          }}
        >
          <OfflineBanner />
        </View>
      ) : null}

      <ScrollView
        refreshControl={
          forceState ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void query.refetch()}
              tintColor={colors.brand}
            />
          )
        }
        contentContainerStyle={{ paddingBottom: scrollBottomPad }}
      >
        <FadeIn>
          <ProductImageCarousel
            uris={vm.imageUris}
            aspectRatio={1}
            onBack={() => router.back()}
            favorited={isDealer ? favorites.isFavorite(vm.id) : false}
            onToggleFavorite={
              isDealer ? () => favorites.toggleFavorite(vm.id) : undefined
            }
          />
        </FadeIn>

        <View
          style={{
            marginTop: -theme.spacing.lg,
            backgroundColor: colors.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingTop: theme.spacing.xl,
            paddingHorizontal: theme.spacing.lg,
            gap: theme.spacing.lg,
            minHeight: 280,
          }}
        >
          {/* Title + dealer price */}
          <ListItemEnter index={0}>
            <View style={{ gap: theme.spacing.sm }}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  flexWrap: 'wrap',
                }}
              >
                {vm.categoryName ? (
                  <AppText variant="caption" color="muted" numberOfLines={1}>
                    {vm.categoryName}
                  </AppText>
                ) : null}
                {orderedBefore ? (
                  <MetaChip label={t('mobile.catalog.orderedBadge')} brand />
                ) : null}
                {vm.isAvailable ? (
                  <MetaChip label={t('mobile.productDetail.inStock')} />
                ) : null}
              </View>

              <AppText
                variant="title"
                weight={titleWeight}
                style={{ fontSize: 24, lineHeight: 30 }}
              >
                {vm.name}
              </AppText>

              {vm.dimensionSummary ? (
                <AppText
                  variant="caption"
                  weight="medium"
                  dir="ltr"
                  style={{ color: colors.textSecondary }}
                >
                  {vm.dimensionSummary}
                </AppText>
              ) : null}

              <View
                style={{
                  marginTop: theme.spacing.xs,
                  gap: 2,
                  alignItems: isRTL ? 'flex-end' : 'flex-start',
                }}
              >
                <AppText variant="caption" color="muted">
                  {t('mobile.productDetail.yourPrice')}
                </AppText>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'baseline',
                    gap: 6,
                  }}
                >
                  <AppText
                    variant="title"
                    weight="semibold"
                    dir="ltr"
                    style={{ fontSize: 26, lineHeight: 32, color: colors.textPrimary }}
                  >
                    {vm.price != null ? formatCurrency(vm.price) : '—'}
                  </AppText>
                  {vm.unit ? (
                    <AppText variant="caption" color="muted">
                      / {vm.unit}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </View>
          </ListItemEnter>

          {/* Specs: SKU + category */}
          <ListItemEnter index={1}>
            <View
              style={{
                borderRadius: theme.radius.xl,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
                ...cardLift,
              }}
            >
              <AppText variant="label" weight={titleWeight}>
                {t('mobile.productDetail.specs')}
              </AppText>
              <SpecRow
                label={t('mobile.productDetail.sku')}
                value={vm.sku ?? '—'}
                ltr
              />
              {vm.categoryName ? (
                <SpecRow
                  label={t('mobile.productDetail.category')}
                  value={vm.categoryName}
                />
              ) : null}
              {vm.unit ? (
                <SpecRow label={t('mobile.productDetail.unit')} value={vm.unit} />
              ) : null}
            </View>
          </ListItemEnter>

          {/* Measurements — capped panel; scroll when many specs */}
          <ListItemEnter index={2}>
            <View
              style={{
                borderRadius: theme.radius.xl,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
                ...cardLift,
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  paddingTop: theme.spacing.md,
                  paddingBottom: theme.spacing.sm,
                }}
              >
                <AppText variant="label" weight={titleWeight}>
                  {t('mobile.productDetail.dimensions')}
                </AppText>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: theme.radius.full,
                    backgroundColor: colors.brandSoft,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="medium"
                    dir="ltr"
                    style={{ color: colors.brand, fontSize: 11 }}
                  >
                    {vm.dimensions.length}
                  </AppText>
                  {vm.dimensions.length > 4 ? (
                    <Ionicons name="swap-vertical-outline" size={12} color={colors.brand} />
                  ) : null}
                </View>
              </View>

              {vm.dimensions.length ? (
                <View style={{ position: 'relative' }}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={vm.dimensions.length > 4}
                    style={{ maxHeight: 228 }}
                    contentContainerStyle={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      flexWrap: 'wrap',
                      gap: theme.spacing.sm,
                      paddingHorizontal: theme.spacing.md,
                      paddingBottom: vm.dimensions.length > 4 ? theme.spacing.lg : theme.spacing.md,
                    }}
                  >
                    {vm.dimensions.map((dim) => (
                      <View
                        key={`${dim.kind}-${dim.label}`}
                        style={{
                          width: '47%',
                          flexGrow: 1,
                          minWidth: 132,
                          borderRadius: theme.radius.lg,
                          backgroundColor: dark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(255,255,255,0.72)',
                          borderWidth: StyleSheet.hairlineWidth * 2,
                          borderColor: colors.border,
                          padding: theme.spacing.md,
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: theme.spacing.sm,
                          }}
                        >
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: colors.brandSoft,
                            }}
                          >
                            <Ionicons
                              name={DIM_ICON[dim.kind]}
                              size={16}
                              color={colors.brand}
                            />
                          </View>
                          <AppText
                            variant="caption"
                            color="muted"
                            numberOfLines={1}
                            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                          >
                            {dim.label}
                          </AppText>
                        </View>
                        <AppText
                          variant="body"
                          weight="semibold"
                          dir="ltr"
                          style={{
                            textAlign: isRTL ? 'right' : 'left',
                            fontSize: 17,
                            color:
                              dim.value === '—' ? colors.textMuted : colors.textPrimary,
                          }}
                        >
                          {dim.value}
                        </AppText>
                      </View>
                    ))}
                  </ScrollView>
                  {vm.dimensions.length > 4 ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 28,
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingBottom: 4,
                        backgroundColor: dark
                          ? 'rgba(42,36,37,0.72)'
                          : `${colors.background}B8`,
                      }}
                    >
                      <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
                  <AppText variant="body" color="secondary">
                    {t('mobile.productDetail.dimensionsEmpty')}
                  </AppText>
                </View>
              )}
            </View>
          </ListItemEnter>

          {vm.description ? (
            <ListItemEnter index={3}>
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="label" weight={titleWeight}>
                  {t('mobile.productDetail.description')}
                </AppText>
                <AppText variant="body" color="secondary" style={{ lineHeight: 22 }}>
                  {vm.description}
                </AppText>
              </View>
            </ListItemEnter>
          ) : null}

          {vm.notes.length ? (
            <ListItemEnter index={4}>
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="label" weight={titleWeight}>
                  {t('mobile.productDetail.notes')}
                </AppText>
                {vm.notes.map((note) => (
                  <AppText key={note} variant="body" color="secondary">
                    {note}
                  </AppText>
                ))}
              </View>
            </ListItemEnter>
          ) : null}

          {isDealer && showOrderCta ? (
            <ListItemEnter index={5}>
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: theme.spacing.md,
                  gap: 4,
                }}
              >
                <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
                  {t('mobile.productDetail.orderHintTitle')}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('mobile.productDetail.orderHintBody')}
                </AppText>
              </View>
            </ListItemEnter>
          ) : null}

          {isDealer ? (
            <RelatedProductsRail
              productId={vm.id}
              categoryId={vm.categoryId}
              enabled={!forceState && allowed}
              productDetailHref={productDetailHref}
            />
          ) : null}
        </View>
      </ScrollView>

      {showOrderCta ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: footerClearance,
            backgroundColor: 'transparent',
          }}
        >
          {/* Floating glass dock — shadow outside overflow clip */}
          <View
            style={{
              borderRadius: theme.radius.xl + 4,
              backgroundColor: dark ? colors.surface : 'rgba(255,255,255,0.72)',
              ...theme.elevation.raised,
              shadowOpacity: dark ? 0.5 : 0.18,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: Platform.OS === 'android' ? 12 : 8,
            }}
          >
            <View
              style={{
                borderRadius: theme.radius.xl + 4,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.1)',
              }}
            >
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={dark ? 36 : 52}
                  tint={dark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: dark
                      ? 'rgba(42,36,37,0.55)'
                      : Platform.OS === 'android'
                        ? 'rgba(255,255,255,0.94)'
                        : 'rgba(255,255,255,0.45)',
                  },
                ]}
              />
              <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.md,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      borderWidth: StyleSheet.hairlineWidth * 2,
                      borderColor: dark ? 'rgba(255,255,255,0.16)' : 'rgba(63,52,44,0.12)',
                      borderRadius: theme.radius.xl,
                      backgroundColor: dark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(255,255,255,0.65)',
                      overflow: 'hidden',
                    }}
                  >
                    <Pressable
                      onPress={() => bumpQty(-1)}
                      accessibilityRole="button"
                      accessibilityLabel={t('mobile.productDetail.qtyDecrease')}
                      style={{
                        minWidth: theme.sizes.touch.min,
                        minHeight: theme.sizes.touch.min,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppText variant="title" weight="semibold">
                        −
                      </AppText>
                    </Pressable>
                    <AppText
                      variant="label"
                      weight="semibold"
                      dir="ltr"
                      style={{ minWidth: 32, textAlign: 'center' }}
                    >
                      {qty}
                    </AppText>
                    <Pressable
                      onPress={() => bumpQty(1)}
                      accessibilityRole="button"
                      accessibilityLabel={t('mobile.productDetail.qtyIncrease')}
                      style={{
                        minWidth: theme.sizes.touch.min,
                        minHeight: theme.sizes.touch.min,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppText variant="title" weight="semibold">
                        +
                      </AppText>
                    </Pressable>
                  </View>

                  <View style={{ flex: 1, alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
                    <AppText variant="caption" color="muted">
                      {t('mobile.productDetail.lineTotal')}
                    </AppText>
                    <AppText variant="body" weight="semibold" dir="ltr">
                      {lineTotal != null ? formatCurrency(lineTotal) : '—'}
                    </AppText>
                  </View>
                </View>

                <PrimaryButton
                  label={t('mobile.productDetail.orderThisProduct')}
                  onPress={onCreateOrder}
                  style={{ borderRadius: theme.radius.xl, minHeight: 50 }}
                  haptic="medium"
                />
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </AppScreen>
  );
}

function MetaChip({ label, brand }: { label: string; brand?: boolean }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.radius.full,
        backgroundColor: brand ? colors.brandSoft : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText
        variant="caption"
        weight="medium"
        style={{ color: brand ? colors.brand : colors.textSecondary, fontSize: 11 }}
      >
        {label}
      </AppText>
    </View>
  );
}

function SpecRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: 2,
      }}
    >
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText
        variant="body"
        weight="medium"
        dir={ltr ? 'ltr' : undefined}
        style={{ color: colors.textPrimary, flexShrink: 1, textAlign: isRTL ? 'left' : 'right' }}
        numberOfLines={1}
      >
        {value}
      </AppText>
    </View>
  );
}

function DetailNav({ onBack }: { onBack: () => void }) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: theme.sizes.touch.min,
        marginBottom: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <BackButton onPress={onBack} label={t('mobile.productDetail.back')} />
      <AppText variant="title" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
        {t('mobile.productDetail.title')}
      </AppText>
    </View>
  );
}
