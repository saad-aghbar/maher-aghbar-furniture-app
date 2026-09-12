import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listSpecOptionGroups, listSpecOptionValues } from '@/api/modules/catalog';
import { listProductVariants } from '@/api/modules/catalogAdmin';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { ActionSheet } from '@/components/sheets/ActionSheet';
import { catalogPickForOrderHref } from '@/features/catalog/catalogPickForOrder';
import { navigateToCreateOrder } from '@/features/catalog/newOrderDeepLink';
import { useFavoriteProductsQuery, usePreviouslyOrderedQuery } from '@/features/catalog/query';
import { useDealerFavorites } from '@/features/catalog/useDealerFavorites';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { CropPreviewSheet } from './components/CropPreviewSheet';
import { OrderBasketLineCard } from './components/OrderBasketLineCard';
import { OrderLineSpecSheet } from './components/OrderLineSpecSheet';
import { ScanReviewScreen } from './ScanReviewScreen';
import { aiStateMessageKey } from './aiIntakeHumanState';
import { addEmptyBasketLine, lineHasProduct } from './newOrderBasket';
import { emptyOrderLine, type NewOrderLine } from './newOrderLine';
import { useOrderBasket } from './OrderBasketProvider';
import { useHandwrittenScan } from './useHandwrittenScan';

export function OrderBasketScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const allowed = can(user, 'request.create');
  const canUpload = can(user, 'document.manage');
  const canAi = can(user, 'request.create') || can(user, 'ai-intake.manage');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const basket = useOrderBasket();
  const lines = basket.lines;
  const [specLineId, setSpecLineId] = useState<string | null>(null);

  const namedLines = lines.filter(lineHasProduct);
  const specLine = lines.find((line) => line.id === specLineId) ?? null;

  const favorites = useDealerFavorites(user?.id);
  const orderedQuery = usePreviouslyOrderedQuery(Boolean(user?.customerId));
  const favoriteProductsQuery = useFavoriteProductsQuery(
    favorites.favoriteIds,
    Boolean(user?.id) && favorites.ready,
  );
  const catalogHits = useMemo(
    () => [...(favoriteProductsQuery.products ?? []), ...(orderedQuery.data ?? [])],
    [favoriteProductsQuery.products, orderedQuery.data],
  );

  const specGroupsQuery = useQuery({
    queryKey: queryKeys.catalog.specOptionGroups({ pageSize: 100 }),
    queryFn: () => listSpecOptionGroups({ page: 1, pageSize: 100 }),
    enabled: allowed,
    staleTime: 60_000,
  });
  const specValuesQuery = useQuery({
    queryKey: queryKeys.catalog.specOptionValues({ pageSize: 200 }),
    queryFn: () => listSpecOptionValues({ page: 1, pageSize: 200 }),
    enabled: allowed,
    staleTime: 60_000,
  });
  const variantsQuery = useQuery({
    queryKey: queryKeys.catalog.variants(specLine?.productId ?? '', { includeInactive: false }),
    queryFn: () => listProductVariants(specLine?.productId ?? '', false),
    enabled: allowed && Boolean(specLine?.productId),
    staleTime: 30_000,
  });

  const scan = useHandwrittenScan({
    enabled: canAi && canUpload,
    catalogHits,
    onLines: (scanned) => {
      basket.setLines((prev) => {
        if (!prev.some(lineHasProduct)) return scanned.length ? scanned : [emptyOrderLine()];
        return [...prev.filter(lineHasProduct), ...scanned];
      });
    },
  });

  const footerClearance = stickyCtaBottomInset(
    insets.bottom,
    theme.spacing.sm,
    DEALER_TAB_BAR_CLEARANCE,
  );
  const scrollPad = 88 + footerClearance + theme.spacing.lg;
  const aiKey = aiStateMessageKey(scan.aiState);

  const patchLine = (id: string, next: NewOrderLine) => {
    basket.patchLine(id, next);
  };

  const addCustom = () => {
    void haptics.selection();
    const blank = lines.find((line) => !lineHasProduct(line));
    if (blank) return;
    basket.setLines((prev) => addEmptyBasketLine(prev));
  };

  const confirmBasket = () => {
    if (!namedLines.length) {
      void haptics.error();
      return;
    }
    void haptics.confirmMedium();
    navigateToCreateOrder(router);
  };

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  const leadSize = theme.sizes.touch.min;

  return (
    <AppScreen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: scrollPad,
        }}
      >
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
            <ScreenBackLead fallback="/(app)/(customer)/(tabs)/catalog" />
          </View>
          <AppText
            variant="largeTitle"
            weight={titleWeight}
            align="center"
            numberOfLines={1}
            style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
          >
            {t('mobile.newOrder.basket')}
          </AppText>
        </View>
        <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
          {t('mobile.newOrder.basketPageHint')}
        </AppText>

        {namedLines.length || lines.some((line) => !lineHasProduct(line)) ? (
          lines.map((line, index) => (
            <ListItemEnter key={line.id} index={index}>
              <OrderBasketLineCard
                line={line}
                index={index}
                onChange={(next) => patchLine(line.id, next)}
                onRemove={() => basket.removeLine(line.id)}
                onEditSpec={() => setSpecLineId(line.id)}
              />
            </ListItemEnter>
          ))
        ) : (
          <DealerEmptyPanel text={t('mobile.newOrder.basketEmpty')} icon="bag-handle-outline" />
        )}

        <DealerBoard title={t('mobile.newOrder.addLine')} titleWeight={titleWeight}>
          <View style={{ gap: theme.spacing.sm }}>
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.newOrder.addCustomItem')}
              testID="order-basket-add-custom"
              onPress={addCustom}
              style={{
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                paddingHorizontal: theme.spacing.md,
                justifyContent: 'center',
              }}
            >
              <AppText weight={titleWeight}>{t('mobile.newOrder.addCustomItem')}</AppText>
            </AnimatedPressable>
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.newOrder.addFromCatalog')}
              testID="order-basket-add-catalog"
              onPress={() => {
                void haptics.selection();
                router.navigate(catalogPickForOrderHref());
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                paddingHorizontal: theme.spacing.md,
                justifyContent: 'center',
              }}
            >
              <AppText weight={titleWeight}>{t('mobile.newOrder.addFromCatalog')}</AppText>
            </AnimatedPressable>
            {canAi && canUpload ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.newOrder.handwritten')}
                testID="order-basket-scan"
                disabled={scan.uploading}
                onPress={scan.openPicker}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                }}
              >
                <AppText weight={titleWeight} color="brand">
                  {t('mobile.newOrder.handwritten')}
                </AppText>
              </AnimatedPressable>
            ) : null}
            {aiKey ? (
              <AppText variant="caption" color="brand">
                {t(aiKey)}
              </AppText>
            ) : null}
          </View>
        </DealerBoard>
      </ScrollView>

      <FloatingActionDock floating tabClearance={DEALER_TAB_BAR_CLEARANCE}>
        <PrimaryButton
          label={t('mobile.newOrder.confirmBasket')}
          testID="order-basket-confirm"
          disabled={!namedLines.length}
          onPress={confirmBasket}
          haptic="medium"
          style={{
            borderRadius: theme.radius.xl,
            minHeight: theme.sizes.touch.min,
            alignSelf: isRTL ? 'stretch' : 'stretch',
          }}
        />
      </FloatingActionDock>

      <OrderLineSpecSheet
        open={Boolean(specLine)}
        onClose={() => setSpecLineId(null)}
        line={specLine}
        onChange={(next) => {
          patchLine(next.id, next);
        }}
        variants={variantsQuery.data ?? []}
        groups={specGroupsQuery.data?.data ?? []}
        values={specValuesQuery.data?.data ?? []}
      />

      <ActionSheet
        open={scan.pickerOpen}
        onClose={() => scan.setPickerOpen(false)}
        title={t('mobile.newOrder.handwritten')}
        actions={[
          {
            label: t('mobile.newOrder.camera'),
            icon: 'camera-outline',
            deferUntilClosed: true,
            onPress: () => void scan.pickCamera(),
          },
          {
            label: t('mobile.newOrder.gallery'),
            icon: 'images-outline',
            deferUntilClosed: true,
            onPress: () => void scan.pickGallery(),
          },
        ]}
      />

      <ScanReviewScreen
        open={scan.scanReviewOpen}
        lines={scan.scanLines}
        onChange={scan.setScanLines}
        onClose={() => scan.setScanReviewOpen(false)}
        onOpenCrop={() => scan.setCropPreviewOpen(true)}
        onConfirm={scan.confirmScan}
      />

      <CropPreviewSheet
        open={scan.cropPreviewOpen}
        uri={scan.scanPhotoUri}
        onClose={() => scan.setCropPreviewOpen(false)}
      />
    </AppScreen>
  );
}
