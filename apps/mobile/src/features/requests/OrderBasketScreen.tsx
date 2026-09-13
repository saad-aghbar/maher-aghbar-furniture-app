import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  customItemHref,
  customizeVariantHref,
  navigateToCreateOrder,
} from '@/features/catalog/newOrderDeepLink';
import { useFavoriteProductsQuery, usePreviouslyOrderedQuery } from '@/features/catalog/query';
import { useDealerFavorites } from '@/features/catalog/useDealerFavorites';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { CropPreviewSheet } from './components/CropPreviewSheet';
import { OrderBasketLineCard } from './components/OrderBasketLineCard';
import { ScanReviewScreen } from './ScanReviewScreen';
import { aiStateMessageKey } from './aiIntakeHumanState';
import { basketLineKind, lineHasProduct } from './newOrderBasket';
import { emptyOrderLine, type NewOrderLine } from './newOrderLine';
import { useOrderBasket } from './OrderBasketProvider';
import { useHandwrittenScan } from './useHandwrittenScan';

export function OrderBasketScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const allowed = can(user, 'request.create');
  const canUpload = can(user, 'document.manage');
  const canAi = can(user, 'request.create') || can(user, 'ai-intake.manage');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const basket = useOrderBasket();
  const namedLines = basket.lines.filter(lineHasProduct);
  const waitsForFactory = namedLines.some((line) => basketLineKind(line) === 'custom');

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
  const scrollPad = 120 + footerClearance + theme.spacing.lg;
  const aiKey = aiStateMessageKey(scan.aiState);

  const patchLine = (id: string, next: NewOrderLine) => {
    basket.patchLine(id, next);
  };

  const editLine = (line: NewOrderLine) => {
    void haptics.selection();
    if (!line.productId.trim()) {
      router.push(customItemHref(line.id));
      return;
    }
    router.push(
      customizeVariantHref(line.productId, line.variantId, Number(line.quantity) || 1, {
        lineId: line.id,
      }),
    );
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
    <AppScreen edges={{ top: true, bottom: false }}>
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

        {namedLines.length ? (
          namedLines.map((line, index) => (
            <ListItemEnter key={line.id} index={index}>
              <OrderBasketLineCard
                line={line}
                index={index}
                onChange={(next) => patchLine(line.id, next)}
                onRemove={() => basket.removeLine(line.id)}
                onEdit={() => editLine(line)}
              />
            </ListItemEnter>
          ))
        ) : (
          <DealerEmptyPanel text={t('mobile.newOrder.basketEmpty')} icon="bag-handle-outline" />
        )}

        <DealerBoard title={t('mobile.newOrder.addLine')} titleWeight={titleWeight}>
          <View style={{ gap: theme.spacing.sm }}>
            <BasketAddWell
              testID="order-basket-add-custom"
              icon="color-wand-outline"
              label={t('mobile.newOrder.addCustomItem')}
              titleWeight={titleWeight}
              onPress={() => {
                void haptics.selection();
                router.push(customItemHref());
              }}
            />
            <BasketAddWell
              testID="order-basket-add-catalog"
              icon="grid-outline"
              label={t('mobile.newOrder.addFromCatalog')}
              titleWeight={titleWeight}
              onPress={() => {
                void haptics.selection();
                router.navigate(catalogPickForOrderHref());
              }}
            />
            {canAi && canUpload ? (
              <BasketAddWell
                testID="order-basket-scan"
                icon="scan-outline"
                label={t('mobile.newOrder.handwritten')}
                titleWeight={titleWeight}
                branded
                disabled={scan.uploading}
                onPress={scan.openPicker}
              />
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
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          {waitsForFactory ? (
            <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
              {t('mobile.newOrder.basketWaitsForFactoryPrice')}
            </AppText>
          ) : null}
          <PrimaryButton
            label={t('mobile.newOrder.confirmBasket')}
            testID="order-basket-confirm"
            disabled={!namedLines.length}
            onPress={confirmBasket}
            haptic="medium"
            style={{
              borderRadius: theme.radius.xl,
              minHeight: 50,
            }}
          />
        </View>
      </FloatingActionDock>

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

function BasketAddWell({
  icon,
  label,
  onPress,
  testID,
  titleWeight,
  branded,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  titleWeight: 'medium' | 'semibold';
  onPress: () => void;
  testID: string;
  branded?: boolean;
  disabled?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: branded ? colors.brand : colors.borderStrong,
        backgroundColor: branded ? colors.brandSoft : colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.md,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={18} color={branded ? colors.brand : colors.textPrimary} />
      </View>
      <AppText weight={titleWeight} color={branded ? 'brand' : 'primary'} style={{ flex: 1 }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
