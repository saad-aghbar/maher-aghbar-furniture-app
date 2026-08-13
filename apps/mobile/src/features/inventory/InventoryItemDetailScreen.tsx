import type { Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Platform, Pressable, RefreshControl, View } from 'react-native';
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

  const stockLabel = detail.isLowStock
    ? t('mobile.inventory.lowStock')
    : t('mobile.inventory.inStock');
  const materialTypeLabel = formatInventoryMaterialType(detail.materialType, t);

  const HeaderShell = reduce ? View : Animated.View;
  const headerEnter = reduce
    ? {}
    : { entering: FadeInDown.delay(60).duration(380).damping(22) };

  return (
    <AppScreen
      edges={{ top: true, bottom: false }}
      backFallback={'/(app)/(admin)/(tabs)/inventory' as Href}
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
            <View style={{ gap: theme.spacing.xs }}>
              <AppText
                variant="caption"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  letterSpacing: locale === 'ar' ? 0 : 1.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  color: colors.brand,
                }}
              >
                {t('mobile.inventory.pulseEyebrow')}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: theme.spacing.sm,
                }}
              >
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <AppText
                    variant="title"
                    weight={locale === 'ar' ? 'medium' : 'semibold'}
                  >
                    {detail.name}
                  </AppText>
                  <AppText variant="caption" color="muted" weight="regular" dir="ltr">
                    {detail.sku}
                    {materialTypeLabel ? ` · ${materialTypeLabel}` : ''}
                  </AppText>
                </View>
                <StatusBadge
                  status={detail.isLowStock ? 'OVERDUE' : 'ACTIVE'}
                  label={stockLabel}
                  dot
                />
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

            <View
              style={{
                width: '100%',
                alignSelf: 'stretch',
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.lg,
                paddingHorizontal: theme.spacing.lg,
                paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
                paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
                borderRadius: theme.radius.xl,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: detail.isLowStock ? colors.warning : colors.borderStrong,
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
                  backgroundColor: detail.isLowStock ? colors.warning : colors.brand,
                  opacity: detail.isLowStock ? 0.85 : 0.55,
                }}
              />
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
            </View>

            {detail.balances.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
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
                  {t('mobile.inventory.byWarehouse')}
                </AppText>
                <View
                  style={{
                    borderRadius: theme.radius.xl,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    overflow: 'hidden',
                    ...theme.elevation.card,
                  }}
                >
                  {detail.balances.map((b, i) => (
                    <View
                      key={b.warehouseId}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: theme.spacing.md,
                        paddingVertical: theme.spacing.md,
                        paddingHorizontal: theme.spacing.lg,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <AppText
                        variant="body"
                        weight={locale === 'ar' ? 'regular' : 'medium'}
                        style={{ flex: 1 }}
                      >
                        {b.warehouseName}
                      </AppText>
                      <AppText
                        variant="body"
                        weight={locale === 'ar' ? 'medium' : 'semibold'}
                        dir="ltr"
                      >
                        {b.quantityLabel}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ gap: theme.spacing['2xs'], marginTop: theme.spacing.xs }}>
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
                {t('mobile.inventory.adjustmentHistory')}
              </AppText>
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
                  gap: theme.spacing.md,
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
                    opacity: 0.7,
                  }}
                />
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <AppText
                      variant="body"
                      weight={locale === 'ar' ? 'medium' : 'semibold'}
                      style={{ flex: 1 }}
                    >
                      {resolvedType}
                    </AppText>
                    <AppText
                      variant="body"
                      weight={locale === 'ar' ? 'medium' : 'semibold'}
                      color={
                        qtyNegative ? 'warning' : qtyPositive ? 'success' : 'primary'
                      }
                      dir="ltr"
                    >
                      {item.quantityLabel}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="muted">
                    {item.warehouseName}
                  </AppText>
                  <AppText variant="caption" color="muted" dir="ltr">
                    {formatDateTime(item.createdAt)}
                  </AppText>
                  {item.notes ? (
                    <AppText variant="caption" color="secondary">
                      {item.notes}
                    </AppText>
                  ) : null}
                  {item.showCost && item.costLabel ? (
                    <AppText variant="caption" color="secondary" dir="ltr">
                      {t('mobile.inventory.cost', { value: item.costLabel })}
                    </AppText>
                  ) : null}
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
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
              ...theme.elevation.raised,
            }}
          >
            <PrimaryButton
              label={t('mobile.inventory.receive')}
              onPress={() => setAddOpen(true)}
            />
          </View>
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
