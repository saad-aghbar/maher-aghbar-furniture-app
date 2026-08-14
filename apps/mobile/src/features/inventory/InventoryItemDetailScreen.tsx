import type { Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Platform, Pressable, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { ListItemEnter, haptics, useReducedMotion } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import {
  pickAccessoryPhotoFromLibrary,
  uploadAccessoryImage,
  uploadAccessoryPhotoUri,
} from './accessoryPhotoUpload';
import { useAccessoryCamera } from './components/AccessoryCameraProvider';
import { AccessoryPhotoSourceSheet } from './components/AccessoryPhotoSourceSheet';
import { AddStockSheet } from './components/AddStockSheet';
import {
  InventoryBoardCard,
  InventoryQtyStrip,
  InventorySectionHeader,
} from './components/InventoryBoardCard';
import { InventoryDetailSkeleton } from './components/InventorySkeleton';
import {
  flattenInventoryTransactionPages,
  useInventoryItemQuery,
  useInventoryTransactionsInfiniteQuery,
  useReceiveStockMutation,
  useUpdateInventoryItemMutation,
  useWarehousesQuery,
} from './query';
import {
  formatInventoryMaterialType,
  selectInventoryItemDetail,
  selectInventoryTransaction,
} from './selectInventory';

type InventoryItemDetailScreenProps = {
  itemId: string;
};

function lifecycleEyebrow(
  itemClass: string | null | undefined,
  t: (key: string) => string,
): string {
  if (itemClass === 'FINISHED_GOOD') return t('mobile.inventory.finishedHeading');
  if (itemClass === 'SEMI_FINISHED_GOOD') return t('mobile.inventory.semiHeading');
  return t('mobile.inventory.pulseEyebrow');
}

function txIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'PURCHASE_RECEIPT':
    case 'FINISHED_GOODS_RECEIPT':
      return 'download-outline';
    case 'PRODUCTION_ISSUE':
    case 'DELIVERY_ISSUE':
      return 'arrow-up-outline';
    case 'PRODUCTION_RETURN':
    case 'CUSTOMER_RETURN':
      return 'return-down-back-outline';
    case 'WAREHOUSE_TRANSFER':
      return 'swap-horizontal-outline';
    case 'SCRAP':
    case 'DAMAGE':
      return 'warning-outline';
    case 'INVENTORY_ADJUSTMENT':
      return 'options-outline';
    default:
      return 'cube-outline';
  }
}

export function InventoryItemDetailScreen({ itemId }: InventoryItemDetailScreenProps) {
  const { user } = useAuth();
  const { t, locale, formatDateTime, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const reduce = useReducedMotion();
  const allowed = can(user, 'inventory.read');
  const canReceive = can(user, 'inventory.receive');
  const canEditPhoto = can(user, 'inventory.adjust');

  const [addOpen, setAddOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);

  const itemQuery = useInventoryItemQuery(itemId, allowed);
  const txQuery = useInventoryTransactionsInfiniteQuery(itemId, allowed);
  const warehousesQuery = useWarehousesQuery(canReceive && addOpen);
  const receiveMutation = useReceiveStockMutation(itemId);
  const updateItemMutation = useUpdateInventoryItemMutation();
  const { openAccessoryCamera } = useAccessoryCamera();

  const detail = useMemo(
    () => (itemQuery.data ? selectInventoryItemDetail(itemQuery.data, locale) : null),
    [itemQuery.data, locale],
  );

  const transactions = useMemo(() => {
    if (!detail) return [];
    return flattenInventoryTransactionPages(txQuery.data).map((tx) =>
      selectInventoryTransaction(tx, locale, detail.unit),
    );
  }, [txQuery.data, locale, detail]);

  const addStockBalances = useMemo(
    () =>
      (detail?.balances ?? []).map((b) => ({
        warehouseId: b.warehouseId,
        quantityLabel: b.quantityLabel,
        availableQty: b.availableQty,
      })),
    [detail?.balances],
  );

  const refreshing =
    (itemQuery.isRefetching || txQuery.isRefetching) && !txQuery.isFetchingNextPage;

  const stickyBottom = SURFACE_TAB_BAR_CLEARANCE;
  const stickyPad = canReceive ? stickyBottom + 88 : theme.spacing['3xl'];

  async function onRefresh() {
    await Promise.all([itemQuery.refetch(), txQuery.refetch()]);
  }

  async function saveAccessoryPhoto(imageUrl: string | null) {
    if (!detail) return;
    try {
      await updateItemMutation.mutateAsync({
        id: detail.id,
        body: { imageUrl },
      });
      void haptics.confirmMedium();
      showToast({
        variant: 'success',
        message: t('mobile.inventory.photoSaved'),
      });
    } catch {
      void haptics.error();
      showToast({
        variant: 'error',
        message: t('mobile.inventory.photoSaveFailed'),
      });
    }
  }

  async function takeAccessoryPhoto() {
    if (!detail || photoBusy) return;
    try {
      const localUri = await openAccessoryCamera();
      if (!localUri) return;
      setPhotoBusy(true);
      try {
        const remoteUrl = await uploadAccessoryPhotoUri(localUri);
        await saveAccessoryPhoto(remoteUrl);
      } finally {
        setPhotoBusy(false);
      }
    } catch {
      void haptics.error();
      Alert.alert(t('mobile.inventory.photoUploadFailed'));
      setPhotoBusy(false);
    }
  }

  async function chooseAccessoryPhoto() {
    if (!detail || photoBusy) return;
    try {
      const picked = await pickAccessoryPhotoFromLibrary(t);
      if (!picked) return;
      setPhotoBusy(true);
      try {
        const remoteUrl = await uploadAccessoryImage(picked.uri, picked.fileName, picked.mimeType);
        await saveAccessoryPhoto(remoteUrl);
      } finally {
        setPhotoBusy(false);
      }
    } catch {
      void haptics.error();
      Alert.alert(t('mobile.inventory.photoUploadFailed'));
      setPhotoBusy(false);
    }
  }

  function onAccessoryPhotoPress() {
    if (!detail?.isAccessory || !canEditPhoto || photoBusy) return;
    setPhotoSourceOpen(true);
  }

  if (!allowed) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/inventory' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (itemQuery.isLoading && !itemQuery.data) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/inventory' as Href}>
        <InventoryDetailSkeleton />
      </AppScreen>
    );
  }

  if ((itemQuery.isError && !itemQuery.data) || !detail) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/inventory' as Href}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.inventory.errorTitle')}
          description={t('mobile.inventory.errorBody')}
          retryLabel={t('mobile.inventory.retry')}
          onRetry={() => void itemQuery.refetch()}
        />
      </AppScreen>
    );
  }

  const stockLabel = detail.quarantined
    ? t('mobile.inventory.lotStatus.QUARANTINED')
    : detail.isLowStock
      ? t('mobile.inventory.lowStock')
      : detail.itemClass === 'FINISHED_GOOD' &&
          detail.freeQty > 0 &&
          detail.reservedQty <= 0
        ? t('mobile.inventory.lotStatus.READY')
        : t('mobile.inventory.inStock');
  const stockStatus = detail.quarantined
    ? 'QUARANTINED'
    : detail.isLowStock
      ? 'OVERDUE'
      : detail.itemClass === 'FINISHED_GOOD' &&
          detail.freeQty > 0 &&
          detail.reservedQty <= 0
        ? 'READY'
        : 'ACTIVE';
  const materialTypeLabel = formatInventoryMaterialType(detail.materialType, t);
  const showBreakdown =
    detail.itemClass === 'FINISHED_GOOD' ||
    detail.itemClass === 'SEMI_FINISHED_GOOD' ||
    detail.reservedQty > 0;
  const heroAccent = detail.quarantined
    ? colors.warning
    : detail.isLowStock
      ? colors.warning
      : detail.itemClass === 'FINISHED_GOOD'
        ? colors.success
        : colors.brand;
  const heroIcon: keyof typeof Ionicons.glyphMap =
    detail.itemClass === 'FINISHED_GOOD'
      ? 'cube-outline'
      : detail.itemClass === 'SEMI_FINISHED_GOOD'
        ? 'layers-outline'
        : 'cube-outline';

  const HeaderShell = reduce ? View : Animated.View;
  const headerEnter = reduce
    ? {}
    : { entering: FadeInDown.delay(60).duration(380).damping(22) };

  return (
    <AppScreen
      edges={{ top: true, bottom: false }}
    >
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={transactions}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: stickyPad,
          flexGrow: 1,
        }}
        ListHeaderComponentStyle={{ width: '100%', alignSelf: 'stretch' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        onEndReached={() => {
          if (txQuery.hasNextPage && !txQuery.isFetchingNextPage) {
            void txQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <HeaderShell
            {...headerEnter}
            style={{
              width: '100%',
              alignSelf: 'stretch',
              gap: theme.spacing.lg,
              marginBottom: theme.spacing.md,
            }}
          >
            <View style={{ gap: theme.spacing.sm }}>
              <AppText
                variant="caption"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  letterSpacing: locale === 'ar' ? 0 : 1.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  color: colors.brand,
                }}
              >
                {lifecycleEyebrow(detail.itemClass, t)}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <ScreenBackLead fallback={'/(app)/(admin)/(tabs)/inventory' as Href} />
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: theme.radius.lg,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...theme.elevation.rest,
                  }}
                >
                  <Ionicons name={heroIcon} size={22} color={heroAccent} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xs }}>
                  <AppText
                    variant="title"
                    weight={locale === 'ar' ? 'medium' : 'semibold'}
                    numberOfLines={2}
                  >
                    {detail.name}
                  </AppText>
                  <AppText variant="caption" color="muted" weight="regular" dir="ltr">
                    {detail.sku}
                    {materialTypeLabel ? ` · ${materialTypeLabel}` : ''}
                  </AppText>
                </View>
                <StatusBadge status={stockStatus} label={stockLabel} dot />
              </View>
            </View>

            {detail.isAccessory && (detail.imageUrl || canEditPhoto) ? (
              <Pressable
                accessibilityRole={canEditPhoto ? 'button' : 'image'}
                accessibilityLabel={
                  detail.imageUrl
                    ? t('mobile.inventory.accessoryPhoto')
                    : t('mobile.inventory.takePhoto')
                }
                disabled={!canEditPhoto || photoBusy || updateItemMutation.isPending}
                onPress={onAccessoryPhotoPress}
                style={{
                  width: '100%',
                  aspectRatio: 4 / 3,
                  borderRadius: theme.radius.xl,
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  overflow: 'hidden',
                  opacity: photoBusy || updateItemMutation.isPending ? 0.65 : 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...theme.elevation.card,
                }}
              >
                {detail.imageUrl ? (
                  <Image
                    source={{ uri: detail.imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={{ gap: theme.spacing.xs, paddingHorizontal: theme.spacing.lg }}>
                    <AppText variant="body" weight="medium" color="brand" align="center">
                      {photoBusy
                        ? t('mobile.inventory.photoUploading')
                        : t('mobile.inventory.takePhoto')}
                    </AppText>
                    <AppText variant="caption" color="muted" align="center">
                      {t('mobile.inventory.accessoryPhotoHint')}
                    </AppText>
                  </View>
                )}
              </Pressable>
            ) : null}

            <InventoryBoardCard accent={heroAccent}>
              <AppText
                variant="caption"
                color="muted"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  letterSpacing: locale === 'ar' ? 0 : 0.6,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  fontSize: 11,
                  lineHeight: 14,
                }}
              >
                {t('mobile.inventory.currentQuantity')}
              </AppText>
              {showBreakdown ? (
                <InventoryQtyStrip
                  onHand={detail.onHand}
                  reserved={detail.reservedQty}
                  available={detail.freeQty}
                  emphasizeAvailable={!detail.quarantined}
                  warning={detail.quarantined}
                />
              ) : (
                <AppText
                  variant="heading"
                  weight={locale === 'ar' ? 'medium' : 'semibold'}
                  color={detail.isLowStock ? 'warning' : 'primary'}
                  dir="ltr"
                  style={{
                    fontSize: 28,
                    lineHeight: 36,
                    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
                  }}
                >
                  {detail.quantityLabel}
                </AppText>
              )}
              <AppText
                variant="caption"
                color="muted"
                style={{ width: '100%', flexShrink: 1, lineHeight: 20 }}
              >
                {t('mobile.inventory.quantityReadOnly')}
              </AppText>
              {detail.showCost && detail.costLabel ? (
                <AppText variant="caption" color="secondary" dir="ltr">
                  {t('mobile.inventory.cost', { value: detail.costLabel })}
                </AppText>
              ) : null}
            </InventoryBoardCard>

            {detail.balances.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <InventorySectionHeader
                  icon="business-outline"
                  label={t('mobile.inventory.byWarehouse')}
                  accent={heroAccent}
                />
                <InventoryBoardCard padded={false} accent={heroAccent}>
                  {detail.balances.map((b, i) => (
                    <View
                      key={b.warehouseId}
                      style={{
                        gap: theme.spacing.sm,
                        paddingVertical: theme.spacing.md,
                        paddingHorizontal: theme.spacing.md,
                        paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
                        paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <AppText
                        variant="body"
                        weight={locale === 'ar' ? 'regular' : 'medium'}
                      >
                        {b.warehouseName}
                      </AppText>
                      {showBreakdown ? (
                        <InventoryQtyStrip
                          onHand={b.availableQty}
                          reserved={b.reservedQty}
                          available={b.freeQty}
                          emphasizeAvailable={!detail.quarantined && b.freeQty > 0}
                          warning={detail.quarantined}
                        />
                      ) : (
                        <AppText
                          variant="body"
                          weight={locale === 'ar' ? 'medium' : 'semibold'}
                          dir="ltr"
                        >
                          {b.quantityLabel}
                        </AppText>
                      )}
                    </View>
                  ))}
                </InventoryBoardCard>
              </View>
            ) : null}

            <View style={{ gap: theme.spacing['2xs'], marginTop: theme.spacing.xs }}>
              <InventorySectionHeader
                icon="time-outline"
                label={t('mobile.inventory.adjustmentHistory')}
                accent={colors.info}
              />
              <AppText variant="caption" color="muted">
                {t('mobile.inventory.adjustmentHistoryHint')}
              </AppText>
            </View>
          </HeaderShell>
        }
        ListEmptyComponent={
          txQuery.isLoading ? (
            <AppText variant="caption" color="secondary">
              {t('mobile.inventory.loadingHistory')}
            </AppText>
          ) : (
            <EmptyState
              title={t('mobile.inventory.emptyHistoryTitle')}
              description={t('mobile.inventory.emptyHistoryBody')}
            />
          )
        }
        renderItem={({ item, index }) => {
          const typeKey = `mobile.inventory.txType.${item.type}`;
          const typeLabel = t(typeKey);
          const resolvedType =
            typeLabel === typeKey ? t('mobile.inventory.txType.OTHER') : typeLabel;
          const qtyPositive = item.quantityLabel.trim().startsWith('+');
          const qtyNegative = item.quantityLabel.trim().startsWith('-');

          return (
            <ListItemEnter index={index}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.md,
                  paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
                  paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  overflow: 'hidden',
                  ...theme.elevation.card,
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    ...(isRTL ? { right: 0 } : { left: 0 }),
                    width: 3,
                    backgroundColor: qtyNegative
                      ? colors.warning
                      : qtyPositive
                        ? colors.success
                        : colors.brand,
                    opacity: 0.75,
                  }}
                />
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: qtyNegative
                      ? colors.warningSoft
                      : qtyPositive
                        ? colors.successSoft
                        : colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons
                    name={txIcon(item.type)}
                    size={16}
                    color={
                      qtyNegative
                        ? colors.warning
                        : qtyPositive
                          ? colors.success
                          : colors.brand
                    }
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText
                    variant="body"
                    weight={locale === 'ar' ? 'medium' : 'semibold'}
                    numberOfLines={1}
                  >
                    {resolvedType}
                  </AppText>
                  <AppText variant="caption" color="muted" numberOfLines={1}>
                    {item.warehouseName} · {formatDateTime(item.createdAt)}
                  </AppText>
                  {item.notes ? (
                    <AppText variant="caption" color="secondary" numberOfLines={2}>
                      {item.notes}
                    </AppText>
                  ) : null}
                  {item.showCost && item.costLabel ? (
                    <AppText variant="caption" color="secondary" dir="ltr">
                      {t('mobile.inventory.cost', { value: item.costLabel })}
                    </AppText>
                  ) : null}
                </View>
                <View
                  style={{
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: 4,
                    borderRadius: theme.radius.md,
                    backgroundColor: qtyNegative
                      ? colors.warningSoft
                      : qtyPositive
                        ? colors.successSoft
                        : colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: qtyNegative
                      ? colors.warning
                      : qtyPositive
                        ? colors.success
                        : colors.border,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight={locale === 'ar' ? 'medium' : 'semibold'}
                    color={qtyNegative ? 'warning' : qtyPositive ? 'success' : 'primary'}
                    dir="ltr"
                  >
                    {item.quantityLabel}
                  </AppText>
                </View>
              </View>
            </ListItemEnter>
          );
        }}
      />

      {canReceive ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: stickyBottom,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
          }}
        >
          <PrimaryButton
            label={t('mobile.inventory.receive')}
            onPress={() => setAddOpen(true)}
          />
        </View>
      ) : null}

      <AddStockSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        mode="receive"
        warehouses={warehousesQuery.data ?? []}
        initialItem={{
          id: detail.id,
          sku: detail.sku,
          name: detail.name,
          category: detail.category,
          itemClass: detail.itemClass,
          unit: detail.unit,
          balances: addStockBalances,
        }}
        loading={receiveMutation.isPending}
        onSubmit={(input) => {
          receiveMutation.mutate(
            {
              inventoryItemId: input.inventoryItemId,
              warehouseId: input.warehouseId,
              quantity: input.quantity,
              notes: input.notes,
              idempotencyKey: `mobile-receipt-${input.inventoryItemId}-${Date.now()}`,
            },
            {
              onSuccess: () => {
                void haptics.confirmMedium();
                setAddOpen(false);
                showToast({
                  variant: 'success',
                  message: t('mobile.inventory.receiveStockSuccess'),
                });
              },
              onError: () => {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: t('mobile.inventory.receiveStockFailed'),
                });
              },
            },
          );
        }}
      />

      <AccessoryPhotoSourceSheet
        open={photoSourceOpen}
        onClose={() => setPhotoSourceOpen(false)}
        hasPhoto={Boolean(detail.imageUrl)}
        onTakePhoto={() => void takeAccessoryPhoto()}
        onChoosePhoto={() => void chooseAccessoryPhoto()}
        onRemovePhoto={
          detail.imageUrl ? () => void saveAccessoryPhoto(null) : undefined
        }
      />
    </AppScreen>
  );
}
