import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { listSpecOptionGroups, listSpecOptionValues } from '@/api/modules/catalog';
import { listProductVariants } from '@/api/modules/catalogAdmin';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { CatalogSectionBoard } from '@/features/catalog/components/CatalogSectionBoard';
import { DealerMeasurementsBoard } from '@/features/catalog/components/DealerMeasurementsBoard';
import { DealerOrderSpecsBoard } from '@/features/catalog/components/DealerOrderSpecsBoard';
import { ProductDetailSkeleton } from '@/features/catalog/components/ProductDetailSkeleton';
import { resolveSelectedVariant } from '@/features/catalog/newOrderDeepLink';
import { useBrowseProductQuery } from '@/features/catalog/query';
import {
  selectProductDetail,
  stripVariantCosts,
} from '@/features/catalog/selectProductDetail';
import { upsertBasketLine } from '@/features/requests/newOrderBasket';
import { useOptionalOrderBasket } from '@/features/requests/OrderBasketProvider';
import { seedModifiedLineFromVariant, catalogLineWasModified } from '@/features/requests/seedModifiedLineFromVariant';
import { emptyOrderLine, type NewOrderLine } from '@/features/requests/newOrderLine';
import { NewOrderQtyStepper } from '@/features/requests/components/NewOrderQtyStepper';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';

type Props = {
  productId: string;
  variantId: string;
  qty: string;
  lineId?: string;
};

export function DealerModifyVariantScreen({ productId, variantId, qty, lineId }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const basket = useOptionalOrderBasket();
  const allowed = can(user, 'catalog.read');
  const canCreate = can(user, 'request.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const lineIdTrim = lineId?.trim() ?? '';
  const editing = Boolean(lineIdTrim);
  const waitingBasket = Boolean(editing && basket && !basket.hydrated);
  const existingLine =
    editing && basket?.hydrated
      ? basket.lines.find((row) => row.id === lineIdTrim) ?? null
      : null;
  const catalogProductId = productId.trim() || existingLine?.productId.trim() || '';
  const backFallback = (
    editing
      ? '/(app)/(customer)/(tabs)/new-order'
      : catalogProductId
        ? `/(app)/(customer)/catalog/${catalogProductId}`
        : '/(app)/(customer)/(tabs)/catalog'
  ) as Href;

  const productQuery = useBrowseProductQuery(
    catalogProductId,
    allowed && Boolean(catalogProductId),
  );
  const variantsQuery = useQuery({
    queryKey: queryKeys.catalog.variants(catalogProductId, { includeInactive: false }),
    queryFn: () => listProductVariants(catalogProductId, false),
    enabled: allowed && Boolean(catalogProductId),
    staleTime: 30_000,
  });
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

  const variants = variantsQuery.data ?? [];
  const selectedVariant = resolveSelectedVariant(variants, variantId || existingLine?.variantId);
  const safeVariant = selectedVariant
    ? stripVariantCosts(selectedVariant as unknown as Record<string, unknown>)
    : null;
  const product = productQuery.data;
  const vm = product ? selectProductDetail(product, locale, safeVariant) : null;

  const [line, setLine] = useState<NewOrderLine | null>(null);
  const seededKey = useRef('');

  useEffect(() => {
    if (waitingBasket) return;

    if (existingLine) {
      const key = `line:${lineIdTrim}`;
      if (seededKey.current === key) return;
      seededKey.current = key;
      setLine(existingLine);
      return;
    }

    if (!product || !vm) return;
    const key = `${catalogProductId}:${selectedVariant?.id ?? ''}:${qty}:${lineIdTrim}`;
    if (seededKey.current === key) return;
    seededKey.current = key;
    if (selectedVariant) {
      setLine(
        seedModifiedLineFromVariant({
          productId: product.id,
          productName: vm.name,
          quantity: qty,
          variant: selectedVariant,
          locale,
          imageUrl: vm.imageUris[0],
          dealerPrice: vm.price != null ? String(vm.price) : undefined,
        }),
      );
      return;
    }
    setLine(
      emptyOrderLine({
        productId: product.id,
        customProductName: vm.name,
        quantity: qty,
        variantId: variantId.trim(),
        imageUrl: vm.imageUris[0] ?? '',
        dealerPrice: vm.price != null ? String(vm.price) : '',
      }),
    );
  }, [
    waitingBasket,
    existingLine,
    catalogProductId,
    selectedVariant,
    product,
    vm,
    qty,
    locale,
    lineIdTrim,
    variantId,
  ]);

  const footerClearance = stickyCtaBottomInset(
    insets.bottom,
    theme.spacing.sm,
    DEALER_TAB_BAR_CLEARANCE,
  );
  const scrollBottomPad = 88 + footerClearance + theme.spacing.lg;

  if (!allowed) {
    return (
      <AppScreen>
        <ScreenBackLead fallback={backFallback} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  const waitingCatalog =
    Boolean(catalogProductId) &&
    !existingLine &&
    (productQuery.isLoading || (variantsQuery.isLoading && !productQuery.isFetched));

  if (waitingBasket || waitingCatalog) {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <ProductDetailSkeleton />
      </AppScreen>
    );
  }

  if (!existingLine && !line && (productQuery.isError || !product || !vm)) {
    return (
      <AppScreen>
        <ScreenBackLead fallback={backFallback} />
        <ErrorState
          title={t('mobile.productDetail.errorTitle')}
          description={t('mobile.productDetail.errorBody')}
          retryLabel={t('mobile.productDetail.retry')}
          onRetry={() => {
            void productQuery.refetch();
            void variantsQuery.refetch();
          }}
        />
      </AppScreen>
    );
  }

  const heading =
    (selectedVariant
      ? localizedName(locale, selectedVariant) || selectedVariant.code
      : '') ||
    line?.variantLabel ||
    line?.customProductName ||
    vm?.name ||
    t('mobile.newOrder.editItem');
  const subtitle = vm?.name || line?.customProductName || '';
  const leadSize = theme.sizes.touch.min;

  const onAddToBasket = () => {
    if (!line || !basket || !canCreate) return;
    void haptics.confirmMedium();
    const catalog =
      product && selectedVariant && vm
        ? seedModifiedLineFromVariant({
            productId: product.id,
            productName: vm.name,
            quantity: line.quantity,
            variant: selectedVariant,
            locale,
            imageUrl: vm.imageUris[0],
            dealerPrice: vm.price != null ? String(vm.price) : undefined,
          })
        : null;
    const next: NewOrderLine = {
      ...line,
      id: lineIdTrim || line.id,
      productId: product?.id || line.productId,
      modifiedByDealer: catalog ? catalogLineWasModified(line, catalog) : true,
    };
    basket.setLines((prev) => upsertBasketLine(prev, next));
    showToast({ variant: 'success', message: t('mobile.productDetail.addedToBasket') });
    router.back();
  };

  return (
    <AppScreen edges={{ top: true, bottom: false }}>
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
          numberOfLines={2}
          style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
        >
          {heading}
        </AppText>
        {subtitle ? (
          <AppText
            variant="caption"
            color="muted"
            align="center"
            numberOfLines={1}
            style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {line ? (
        <ScrollView
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: scrollBottomPad,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <ListItemEnter index={0}>
            <CatalogSectionBoard titleWeight={titleWeight}>
              <View
                style={{
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.brand,
                  backgroundColor: colors.brandSoft,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                }}
              >
                <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
                  {t('mobile.lineKind.customized')}
                </AppText>
              </View>
              <AppText variant="caption" color="muted">
                {t('mobile.newOrder.modifyVariantHint')}
              </AppText>
              {(selectedVariant?.sku || line.variantSku) ? (
                <AppText variant="caption" color="muted" dir="ltr">
                  {selectedVariant?.sku || line.variantSku}
                </AppText>
              ) : null}
              <NewOrderQtyStepper
                value={line.quantity}
                onChange={(quantity) => setLine({ ...line, quantity })}
              />
            </CatalogSectionBoard>
          </ListItemEnter>

          <ListItemEnter index={1}>
            <DealerOrderSpecsBoard
              line={line}
              onChange={setLine}
              groups={specGroupsQuery.data?.data ?? []}
              values={specValuesQuery.data?.data ?? []}
              titleWeight={titleWeight}
            />
          </ListItemEnter>

          <ListItemEnter index={2}>
            <DealerMeasurementsBoard
              line={line}
              onChange={setLine}
              titleWeight={titleWeight}
            />
          </ListItemEnter>

          <ListItemEnter index={3}>
            <CatalogSectionBoard
              title={t('mobile.newOrder.itemNotes')}
              titleWeight={titleWeight}
            >
              <AppText variant="caption" color="muted">
                {t('mobile.newOrder.modifyNotesHint')}
              </AppText>
              <TextField
                label={t('mobile.newOrder.itemNotes')}
                value={line.notes}
                onChangeText={(notes) => setLine({ ...line, notes })}
                placeholder={t('mobile.newOrder.modifyNotesPlaceholder')}
                multiline
                copyable
              />
            </CatalogSectionBoard>
          </ListItemEnter>
        </ScrollView>
      ) : null}

      {line && canCreate ? (
        <FloatingActionDock floating tabClearance={DEALER_TAB_BAR_CLEARANCE}>
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <PrimaryButton
              label={
                editing
                  ? t('mobile.newOrder.saveModifiedToBasket')
                  : t('mobile.newOrder.addModifiedToBasket')
              }
              onPress={onAddToBasket}
              haptic="medium"
              style={{ borderRadius: theme.radius.xl, minHeight: 50 }}
            />
          </View>
        </FloatingActionDock>
      ) : null}
    </AppScreen>
  );
}
