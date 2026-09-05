import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { resolveFabricStageLabel, resolveFabricStatusLabel } from '@/features/fabric/fabricCopy';
import { fabricStatusKind, fabricToneForKind } from '@/features/fabric/selectFabricTracker';
import { resolveFabricTone } from '@/features/fabric/fabricToneVisuals';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { getInventoryLotByCode, openFabricLotQrLabelPdf } from './api';

type Props = { code: string };

/**
 * Physical fabric bundle — the object in the employee's hand.
 */
export function FabricBundleDetailScreen({ code }: Props) {
  const { user } = useAuth();
  const { t, isRTL, locale, formatNumber } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions } = usePdfDownload();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/inventory/fabric' as Href;
  const canRead = can(user, 'inventory.read');
  const canProcurement = can(user, 'fabric.procurement.read');
  const canOpenOrder = can(user, 'sales-order.read');
  const canPrint = canRead;
  const [printing, setPrinting] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.inventory.fabricBundle(code),
    queryFn: () => getInventoryLotByCode(code),
    enabled: canRead && Boolean(code),
  });

  const lot = query.data ?? null;
  const fabric = lot?.fabricProcurement ?? null;
  const statusRow = useMemo(
    () => ({
      derivedStatus: String(fabric?.derivedStatus ?? fabric?.state ?? lot?.status ?? ''),
      overridden: Boolean(fabric?.overridden),
      readyForProduction:
        String(fabric?.derivedStatus ?? '') === 'READY_FOR_PRODUCTION' ||
        String(fabric?.derivedStatus ?? '') === 'ISSUED',
      expectedQty: fabric?.expectedQty ?? null,
      arrivedQty: fabric?.arrivedQty ?? Number(lot?.remainingQty ?? lot?.quantity ?? 0),
      attentionCode: null,
    }),
    [fabric, lot],
  );
  const kind = fabricStatusKind(statusRow);
  const tone = resolveFabricTone(fabricToneForKind(kind), colors);
  const statusLabel = resolveFabricStatusLabel(t, statusRow, 'ops');
  const stageLabel = resolveFabricStageLabel(t, fabric?.stageCode);

  if (!canRead) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !lot) {
    return (
      <AppScreen backFallback={backFallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.inventory.fabricBundleMissingTitle')}
          description={t('mobile.inventory.fabricBundleMissingBody', { code })}
          retryLabel={t('mobile.purchasing.fabricRetry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!lot) {
    return (
      <AppScreen backFallback={backFallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <EmptyState title={t('mobile.purchasing.fabricLoading')} />
      </AppScreen>
    );
  }

  const label = fabric?.label ?? lot.inventoryItem.nameEn ?? lot.inventoryItem.sku;
  const remaining = Number(lot.remainingQty ?? lot.quantity);
  const locationLabel =
    lot.locationLabel?.trim() || lot.location?.name?.trim() || lot.location?.code || null;
  const orderNumber = lot.salesOrder?.number ?? lot.salesOrderNumber ?? null;
  const orderId = lot.salesOrder?.id ?? fabric?.salesOrderId ?? null;
  const productName =
    lot.productNameEn ??
    lot.inventoryItem.product?.nameEn ??
    lot.inventoryItem.nameEn ??
    null;
  const dealerName = lot.dealerNameEn ?? lot.dealerNameAr ?? null;
  const productImage =
    lot.productImageUrl ?? lot.inventoryItem.product?.imageUrl ?? null;
  const qr = lot.qrCode ?? code;
  const unit = fabric?.unit ?? lot.inventoryItem.unit ?? '';
  const qtyLabel =
    fabric?.expectedQty != null
      ? `${formatNumber(Number(remaining))} / ${formatNumber(Number(fabric.expectedQty))} ${unit}`.trim()
      : `${formatNumber(Number(remaining))} ${unit}`.trim();

  const railPad = isRTL
    ? { paddingRight: theme.spacing.lg + 4 }
    : { paddingLeft: theme.spacing.lg + 4 };

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
      >
        <ListItemEnter index={0}>
          <Board>
            <View
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                ...railPad,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <Ionicons name="color-palette-outline" size={16} color={colors.brand} />
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand, flex: 1 }}>
                {t('mobile.inventory.fabricBundleEyebrow')}
              </AppText>
              <AppText variant="caption" weight={titleWeight} style={{ color: tone.chipInk }}>
                {statusLabel}
              </AppText>
            </View>
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm, ...railPad }}>
              <AppText variant="heading" weight={titleWeight}>
                {label}
              </AppText>
              {fabric?.role ? (
                <AppText variant="caption" color="secondary">
                  {fabric.role}
                </AppText>
              ) : null}
            </View>
          </Board>
        </ListItemEnter>

        <ListItemEnter index={1}>
          <Board>
            <View
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                ...railPad,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand }} dir="ltr">
                {orderNumber ?? t('mobile.inventory.fabricUnassignedOrder')}
              </AppText>
            </View>
            <View
              style={{
                padding: theme.spacing.lg,
                gap: theme.spacing.md,
                ...railPad,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
              }}
            >
              <ProductThumb uri={productImage} size={64} radius={theme.radius.lg} />
              <View style={{ flex: 1, gap: 4 }}>
                {productName ? (
                  <AppText weight={titleWeight} numberOfLines={2} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {productName}
                  </AppText>
                ) : null}
                {dealerName ? (
                  <AppText
                    variant="caption"
                    color="secondary"
                    numberOfLines={1}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {dealerName}
                  </AppText>
                ) : null}
              </View>
            </View>
          </Board>
        </ListItemEnter>

        <ListItemEnter index={2}>
          <Board>
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md, ...railPad }}>
              <Inset>
                <Fact label={t('mobile.inventory.fabricBundleQty')} value={qtyLabel} ltr />
                <Fact
                  label={t('mobile.purchasing.fabricLocation')}
                  value={locationLabel ?? t('mobile.inventory.fabricBundleNoLocation')}
                />
                <Fact label={t('mobile.inventory.fabricQr')} value={qr} ltr />
                {stageLabel ? (
                  <Fact label={t('mobile.inventory.fabricRequiredFor')} value={stageLabel} />
                ) : null}
              </Inset>
            </View>
          </Board>
        </ListItemEnter>

        <ListItemEnter index={3}>
          <View style={{ gap: theme.spacing.sm }}>
            {canPrint ? (
              <PrimaryButton
                label={t('mobile.inventory.fabricPrintLabel')}
                loading={printing}
                onPress={async () => {
                  if (printing) return;
                  void haptics.selection();
                  const opts = await pickPdfOptions();
                  if (!opts) return;
                  setPrinting(true);
                  try {
                    await openFabricLotQrLabelPdf(lot.id, qr, opts);
                    void haptics.confirmLight();
                  } catch {
                    void haptics.error();
                    showToast({
                      variant: 'error',
                      message: toastCopy(
                        t('mobile.inventory.labelPdfFailedTitle'),
                        t('mobile.inventory.labelPdfFailedBody'),
                      ),
                    });
                  } finally {
                    setPrinting(false);
                  }
                }}
              />
            ) : null}
            {canOpenOrder && orderId ? (
              <SecondaryButton
                label={t('mobile.inventory.fabricOpenOrder')}
                onPress={() => {
                  void haptics.selection();
                  router.push(`/(app)/(admin)/orders/${orderId}` as Href);
                }}
              />
            ) : null}
            {canProcurement && fabric?.id ? (
              <SecondaryButton
                label={t('mobile.inventory.fabricBundleOpenProcurement')}
                onPress={() => {
                  void haptics.selection();
                  router.push(`/(app)/(admin)/purchasing/fabric/${fabric.id}` as Href);
                }}
              />
            ) : null}
          </View>
        </ListItemEnter>
      </ScrollView>
    </AppScreen>
  );
}

function Board({ children }: { children: ReactNode }) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  return (
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
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      {children}
    </View>
  );
}

function Inset({ children }: { children: ReactNode }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      {children}
    </View>
  );
}

function Fact({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  const { isRTL, locale } = useLocale();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <AppText variant="caption" color="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        dir={ltr ? 'ltr' : undefined}
        style={{ flexShrink: 1 }}
      >
        {value}
      </AppText>
    </View>
  );
}
