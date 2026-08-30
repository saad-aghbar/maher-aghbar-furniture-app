import type { Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Image, Platform, Pressable, RefreshControl, View } from 'react-native';
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
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { ListItemEnter, haptics, useReducedMotion } from '@/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import {
  pickAccessoryPhotoFromLibrary,
  uploadAccessoryImage,
  uploadAccessoryPhotoUri,
} from './accessoryPhotoUpload';
import { useAccessoryCamera } from './components/AccessoryCameraProvider';
import { AccessoryPhotoSourceSheet } from './components/AccessoryPhotoSourceSheet';
import { AddStockSheet } from './components/AddStockSheet';
import { InventoryQrSheet, qrItemFromCard } from './components/InventoryQrSheet';
import {
  InventoryBoardCard,
  InventoryQtyStrip,
  InventorySectionHeader,
} from './components/InventoryBoardCard';
import { InventoryDetailSkeleton } from './components/InventorySkeleton';
import { openInventoryLabelPdf, openInventoryQrLabelPdf } from './api';
import { toGoodsReceiptArgs } from './stockMoveSubmit';
import {
  flattenInventoryTransactionPages,
  useInventoryItemQuery,
  useInventoryTransactionsInfiniteQuery,
  useReceiveAgainstPoMutation,
  useReceiveStockMutation,
  useUpdateInventoryItemMutation,
  useWarehousesQuery,
} from './query';
import {
  formatInventoryMaterialType,
  inventoryItemLifecycleEyebrow,
  selectInventoryItemDetail,
  selectInventoryTransaction,
  showsRawMaterialPhoto,
} from './selectInventory';

type InventoryItemDetailScreenProps = {
  itemId: string;
};

function lifecycleEyebrow(
  itemClass: string | null | undefined,
  t: (key: string) => string,
): string {
  if (itemClass === 'FINISHED_GOOD') return t('mobile.inventory.pulseEyebrowFinished');
  if (itemClass === 'SEMI_FINISHED_GOOD') return t('mobile.inventory.pulseEyebrowSemi');
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
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const reduce = useReducedMotion();
  const allowed = can(user, 'inventory.read');
  const canReceive = can(user, 'inventory.receive');
  const canEditPhoto = can(user, 'inventory.adjust');

  const [addOpen, setAddOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const pendingPrintAfterQrRef = useRef(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);

  const itemQuery = useInventoryItemQuery(itemId, allowed);
  const txQuery = useInventoryTransactionsInfiniteQuery(itemId, allowed);
  const warehousesQuery = useWarehousesQuery(canReceive && addOpen);
  const receiveMutation = useReceiveStockMutation(itemId);
  const receivePoMutation = useReceiveAgainstPoMutation(itemId);
  const updateItemMutation = useUpdateInventoryItemMutation();
  const { openAccessoryCamera } = useAccessoryCamera();

  const detail = useMemo(
    () => (itemQuery.data ? selectInventoryItemDetail(itemQuery.data, locale) : null),
    [itemQuery.data, locale],
  );
  const showsSkuPhoto = showsRawMaterialPhoto(detail?.itemClass);

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
        reservedQty: b.reservedQty,
      })),
    [detail?.balances],
  );

  const refreshing =
    (itemQuery.isRefetching || txQuery.isRefetching) && !txQuery.isFetchingNextPage;

  const showReceive = canReceive && detail?.isActive && !detail?.archivedAt && detail?.itemClass !== 'FINISHED_GOOD';
  const stickyPad = showReceive
    ? stickyCtaBottomInset(insets.bottom, theme.spacing.md) + 88
    : theme.spacing['3xl'];

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
      showToast({ variant: 'error', message: t('mobile.inventory.photoUploadFailed') });
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
      showToast({ variant: 'error', message: t('mobile.inventory.photoUploadFailed') });
      setPhotoBusy(false);
    }
  }

  function onAccessoryPhotoPress() {
    if (!showsSkuPhoto || !canEditPhoto || photoBusy) return;
    setPhotoSourceOpen(true);
  }

  function openLabelPdf() {
    if (!detail) return;
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openInventoryLabelPdf(detail.id, detail.sku, opts);
      } catch {
        void haptics.error();
        showToast({
          variant: 'error',
          message: toastCopy(
            t('mobile.inventory.labelPdfFailedTitle'),
            t('mobile.inventory.labelPdfFailedBody'),
          ),
        });
      }
    })();
  }

  function openQrLabelPdf() {
    if (!detail) return;
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openInventoryQrLabelPdf(detail.id, detail.sku, opts);
      } catch {
        void haptics.error();
        showToast({
          variant: 'error',
          message: toastCopy(
            t('mobile.inventory.labelPdfFailedTitle'),
            t('mobile.inventory.labelPdfFailedBody'),
          ),
        });
      }
    })();
  }

  /** Close QR Modal first — iOS will no-op a second Modal while QR is open. */
  function printLabelAfterQrCloses() {
    pendingPrintAfterQrRef.current = true;
    setQrOpen(false);
  }

  function flushPendingPrintAfterQr() {
    if (!pendingPrintAfterQrRef.current) return;
    pendingPrintAfterQrRef.current = false;
    openQrLabelPdf();
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
    const itemClass = itemQuery.data?.itemClass;
    const finished =
      finishedDeepLink || itemClass === 'FINISHED_GOOD';
    const semi =
      semiDeepLink || itemClass === 'SEMI_FINISHED_GOOD';
    const landmark = finished
      ? t('mobile.inventory.finishedOrderTitle')
      : semi
        ? t('mobile.inventory.groupLandmark.semi')
        : undefined;
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/inventory' as Href}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ToastClearance />
        <ErrorState
          landmark={landmark}
          title={
            finished
              ? t('mobile.inventory.finishedOrderErrorTitle')
              : t('mobile.inventory.errorTitle')
          }
          description={
            finished
              ? t('mobile.inventory.finishedOrderErrorBody')
              : t('mobile.inventory.errorBody')
          }
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
  const eyebrow = inventoryItemLifecycleEyebrow(detail.itemClass, t);
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
              {eyebrow ? (
                <AppText
                  variant="caption"
                  weight={locale === 'ar' ? 'regular' : 'medium'}
                  style={{ color: colors.brand }}
                >
                  {eyebrow}
                </AppText>
              ) : null}
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

            {showsSkuPhoto && (detail.imageUrl || canEditPhoto) ? (
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
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.sm,
                  marginTop: theme.spacing.sm,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void haptics.selection();
                    setQrOpen(true);
                  }}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppText variant="caption" weight="semibold" color="brand">
                    {t('mobile.inventory.qrCode')}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void haptics.selection();
                    openLabelPdf();
                  }}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppText variant="caption" weight="semibold" color="brand">
                    {t('mobile.inventory.labelPdf')}
                  </AppText>
                </Pressable>
              </View>
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

            <View style={{ marginTop: theme.spacing.xs }}>
              <InventorySectionHeader
                icon="time-outline"
                label={t('mobile.inventory.adjustmentHistory')}
                accent={colors.info}
              />
            </View>
          </HeaderShell>
        }
        ListEmptyComponent={
          txQuery.isLoading ? (
            <AppText variant="caption" color="secondary">
              {t('mobile.inventory.loadingHistory')}
            </AppText>
          ) : (
            <EmptyState title={t('mobile.inventory.emptyHistoryTitle')} />
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

      {showReceive ? (
        <FloatingActionDock floating>
          <PrimaryButton
            label={t('mobile.inventory.receive')}
            onPress={() => setAddOpen(true)}
          />
        </FloatingActionDock>
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
          imageUrl: detail.imageUrl,
          materialType: detail.materialType,
          onHand: detail.onHand,
          reservedQty: detail.reservedQty,
          availableQty: detail.freeQty,
          balances: addStockBalances,
        }}
        loading={receiveMutation.isPending || receivePoMutation.isPending}
        onSubmit={(input) => {
          const onSuccess = () => {
            void haptics.confirmMedium();
            setAddOpen(false);
            showToast({
              variant: 'success',
              message: t('mobile.inventory.receiveStockSuccess'),
            });
          };
          const onError = () => {
            void haptics.error();
            showToast({
              variant: 'error',
              message: t('mobile.inventory.receiveStockFailed'),
            });
          };
          const po = toGoodsReceiptArgs(input);
          if (po) {
            receivePoMutation.mutate(po, { onSuccess, onError });
            return;
          }
          receiveMutation.mutate(
            {
              inventoryItemId: input.inventoryItemId,
              warehouseId: input.warehouseId,
              quantity: input.quantity,
              notes: input.notes,
              idempotencyKey: `mobile-receipt-${input.inventoryItemId}-${Date.now()}`,
            },
            { onSuccess, onError },
          );
        }}
      />
      <InventoryQrSheet
        open={qrOpen}
        item={qrItemFromCard(detail)}
        onClose={() => setQrOpen(false)}
        onClosed={flushPendingPrintAfterQr}
        onPrint={() => printLabelAfterQrCloses()}
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
      {pdfDownloadSheet}
    </AppScreen>
  );
}
