import { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { FadeIn, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { BrowseProduct } from './api';
import { ProductDetailSkeleton } from './components/ProductDetailSkeleton';
import { ProductImageCarousel } from './components/ProductImageCarousel';
import { catalogProductsFixture } from './fixtures';
import { useBrowseProductQuery } from './query';
import { selectProductDetail } from './selectProductDetail';

type ProductDetailScreenProps = {
  productId: string;
  forceState?: 'loading' | 'error' | 'offline' | 'success';
  fixture?: BrowseProduct;
};

/**
 * Store PDP for dealers/admins — hero + sheet body.
 * Skips consumer-only bits (wishlist, stock badge, related rail, share).
 */
export function ProductDetailScreen({
  productId,
  forceState,
  fixture,
}: ProductDetailScreenProps) {
  const { user } = useAuth();
  const { t, formatCurrency, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const allowed = can(user, 'catalog.read');
  const canCreate = can(user, 'request.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [qty, setQty] = useState(1);
  const query = useBrowseProductQuery(productId, allowed && !forceState);
  const refreshing = query.isRefetching && !query.isLoading;

  const raw: BrowseProduct | undefined =
    forceState === 'success' || forceState === 'offline'
      ? (fixture ??
        catalogProductsFixture.find((p) => p.id === productId) ??
        catalogProductsFixture[0])
      : query.data;

  const vm = raw ? selectProductDetail(raw, locale) : null;

  const footerPad = Math.max(insets.bottom, theme.spacing.md) + theme.spacing.sm;
  const showOrderCta = canCreate || Boolean(forceState);

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

  const onAddToOrder = () => {
    void haptics.confirmMedium();
    const href =
      `/(app)/(customer)/(tabs)/new-order?productId=${encodeURIComponent(vm.id)}&qty=${qty}` as Href;
    router.push(href);
  };

  const bumpQty = (delta: number) => {
    void haptics.selection();
    setQty((q) => Math.max(1, Math.min(99, q + delta)));
  };

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
        contentContainerStyle={{
          paddingBottom: (showOrderCta ? 100 : 40) + footerPad,
        }}
      >
        <FadeIn>
          <ProductImageCarousel
            uris={vm.imageUris}
            aspectRatio={1}
            onBack={() => router.back()}
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
          <ListItemEnter index={0}>
            <View style={{ gap: theme.spacing.sm }}>
              {vm.categoryName ? (
                <AppText variant="caption" color="muted" numberOfLines={1}>
                  {vm.categoryName}
                </AppText>
              ) : null}
              <AppText variant="title" weight={titleWeight}>
                {vm.name}
              </AppText>
              <AppText
                variant="title"
                weight="semibold"
                dir="ltr"
                style={{ marginTop: theme.spacing.xs }}
              >
                {vm.price != null ? formatCurrency(vm.price) : '—'}
              </AppText>
            </View>
          </ListItemEnter>

          {vm.description ? (
            <ListItemEnter index={1}>
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="label" weight={titleWeight}>
                  {t('mobile.productDetail.description')}
                </AppText>
                <AppText variant="body" color="secondary">
                  {vm.description}
                </AppText>
              </View>
            </ListItemEnter>
          ) : null}

          {vm.dimensions.length ? (
            <ListItemEnter index={2}>
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surface,
                  overflow: 'hidden',
                  ...orderBoardShadow(colorScheme),
                }}
              >
                {vm.dimensions.map((dim, i) => (
                  <View
                    key={dim.label}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.md,
                      borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.brandSoft,
                      }}
                    >
                      <Ionicons name="resize-outline" size={18} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="caption" color="muted">
                        {dim.label}
                      </AppText>
                      <AppText variant="body" weight="medium" dir="ltr">
                        {dim.value}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            </ListItemEnter>
          ) : null}

          {vm.notes.length ? (
            <ListItemEnter index={3}>
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
        </View>
      </ScrollView>

      {showOrderCta ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: footerPad,
            backgroundColor: colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.borderStrong,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.borderStrong,
              borderRadius: theme.radius.full,
              backgroundColor: colors.background,
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
              style={{ minWidth: 28, textAlign: 'center' }}
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
          <PrimaryButton
            label={t('mobile.productDetail.addToOrder')}
            onPress={onAddToOrder}
            style={{ flex: 1, borderRadius: theme.radius.full }}
            haptic="medium"
          />
        </View>
      ) : null}
    </AppScreen>
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
