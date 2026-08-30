import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import { ApiError } from '@/api/errors';
import type { DeliveryLoadPiece, DeliveryLoadProduct } from '@/api/modules/deliveries';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useNetwork } from '@/components/network/NetworkProvider';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useSmartBack } from '@/navigation/useSmartBack';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import {
  DELIVERY_FLOOR_CHARCOAL,
  DELIVERY_FLOOR_CREAM,
  deliverySectionLabelStyle,
} from './deliveryFloorStyle';
import { selectDeliveryHumanPhase } from './deliveryHumanPhase';
import { useDeliveryLoadMutations, useDeliveryLoadSheetQuery } from './query';

type Props = {
  deliveryId: string;
};

function productTitle(p: DeliveryLoadProduct, locale: string): string {
  return localizedName(locale, {
    nameEn: p.productNameEn,
    nameAr: p.productNameAr,
    nameHe: p.productNameHe,
  });
}

function warehouseLabel(
  wh: DeliveryLoadProduct['warehouse'],
  locale: string,
): string {
  return localizedName(locale, wh);
}

function PieceRow({
  piece,
  total,
  busy,
  disabled,
  onToggle,
}: {
  piece: DeliveryLoadPiece;
  total: number;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const loaded = Boolean(piece.loadedAt);
  const named = localizedName(
    locale,
    {
      nameEn: piece.nameEn,
      nameAr: piece.nameAr,
      nameHe: piece.nameHe,
    },
    piece.label?.trim() || '',
  );
  const title =
    named ||
    t('mobile.deliveryLoad.packageOf', {
      index: piece.pieceIndex,
      total,
    });

  return (
    <Pressable
      disabled={disabled || busy}
      onPress={() => {
        haptics.selection();
        onToggle();
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md + 2,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: loaded ? colors.successSoft : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: loaded ? colors.success : colors.borderStrong,
        opacity: disabled ? 0.55 : 1,
        minHeight: 64,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: loaded ? colors.success : colors.borderStrong,
          backgroundColor: loaded ? colors.success : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : loaded ? (
          <Ionicons name="checkmark" size={18} color={colors.onBrand ?? '#fff'} />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" weight="semibold" align="start">
          {title}
        </AppText>
        <AppText variant="caption" color={loaded ? 'success' : 'muted'} align="start">
          {loaded
            ? t('mobile.deliveryLoad.onTruck')
            : t('mobile.deliveryLoad.tapToLoad')}
        </AppText>
      </View>
      {!loaded && !disabled ? (
        <Ionicons name="hand-left-outline" size={18} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

function ProductBoard({
  product,
  locale,
  departed,
  busyPieceId,
  onToggle,
}: {
  product: DeliveryLoadProduct;
  locale: string;
  departed: boolean;
  busyPieceId: string | null;
  onToggle: (pieceId: string, loaded: boolean) => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const uri = resolveOrderMediaUri(product.imageUrl);
  const total = product.pieces.length;
  const loadedCount = product.pieces.filter((p) => p.loadedAt).length;
  const locationLabel = product.location
    ? product.location.name || product.location.code
    : null;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        overflow: 'hidden',
        marginBottom: theme.spacing.lg,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View style={{ height: 3, backgroundColor: colors.brand, opacity: 0.35 }} />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: theme.radius.lg,
            backgroundColor: DELIVERY_FLOOR_CHARCOAL,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {uri ? (
            <Image source={{ uri }} style={{ width: 88, height: 88 }} resizeMode="cover" />
          ) : (
            <Ionicons name="cube-outline" size={32} color={DELIVERY_FLOOR_CREAM} />
          )}
        </View>
        <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
          <AppText variant="title" weight="semibold" numberOfLines={2} align="start">
            {productTitle(product, locale)}
          </AppText>
          {product.productionOrder?.number ? (
            <AppText variant="caption" color="secondary" align="start">
              {t('mobile.deliveryLoad.poLabel', {
                number: product.productionOrder.number,
              })}
            </AppText>
          ) : null}
          <AppText variant="caption" color="muted" align="start">
            {t('mobile.deliveryLoad.warehouseLabel', {
              name: warehouseLabel(product.warehouse, locale),
            })}
            {locationLabel ? ` · ${locationLabel}` : ''}
          </AppText>
          <AppText variant="caption" weight="semibold" color="brand" align="start">
            {t('mobile.deliveryLoad.packagesProgress', {
              loaded: loadedCount,
              total,
            })}
          </AppText>
        </View>
      </View>

      <View style={{ padding: theme.spacing.sm, gap: theme.spacing.sm }}>
        {product.pieces.map((piece) => (
          <PieceRow
            key={piece.id}
            piece={piece}
            total={total}
            busy={busyPieceId === piece.id}
            disabled={departed}
            onToggle={() => onToggle(piece.id, Boolean(piece.loadedAt))}
          />
        ))}
      </View>
    </View>
  );
}

export function DeliveryLoadSheetScreen({ deliveryId }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const goBack = useSmartBack('/(app)/(employee)/(tabs)/tasks');
  const allowed = can(user, 'delivery.read');
  const [busyPieceId, setBusyPieceId] = useState<string | null>(null);
  const [departConfirmOpen, setDepartConfirmOpen] = useState(false);

  const query = useDeliveryLoadSheetQuery(deliveryId, allowed);
  const mutations = useDeliveryLoadMutations(deliveryId);
  const sheet = query.data;
  const departed =
    sheet?.status === 'OUT_FOR_DELIVERY' || sheet?.status === 'DELIVERED';
  const humanPhase = selectDeliveryHumanPhase({
    status: sheet?.status,
    loaded: sheet?.loadProgress?.loaded,
    total: sheet?.loadProgress?.total,
    canDepart: sheet?.canDepart,
  });
  const phaseLabel = t(humanPhase.labelKey);
  const phaseWhy = humanPhase.whyKey ? t(humanPhase.whyKey) : null;

  const onToggle = useCallback(
    async (pieceId: string, currentlyLoaded: boolean) => {
      setBusyPieceId(pieceId);
      try {
        if (currentlyLoaded) {
          await mutations.uncheck.mutateAsync(pieceId);
        } else {
          await mutations.check.mutateAsync(pieceId);
          void haptics.confirmLight();
        }
      } catch (err) {
        const code = err instanceof ApiError ? err.code : null;
        showToast({
          variant: 'error',
          message:
            code === 'DELIVERY_LOAD_INCOMPLETE'
              ? t('mobile.deliveryLoad.loadIncomplete')
              : t('mobile.deliveryLoad.actionFailed'),
        });
      } finally {
        setBusyPieceId(null);
      }
    },
    [mutations.check, mutations.uncheck, showToast, t],
  );

  const onDepart = useCallback(async () => {
    try {
      await mutations.depart.mutateAsync();
      setDepartConfirmOpen(false);
      haptics.completeStrong();
      showToast({
        variant: 'success',
        message: t('mobile.deliveryLoad.departedToast'),
      });
      goBack();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      showToast({
        variant: 'error',
        message:
          code === 'DELIVERY_LOAD_INCOMPLETE'
            ? t('mobile.deliveryLoad.loadIncomplete')
            : t('mobile.deliveryLoad.actionFailed'),
      });
    }
  }, [goBack, mutations.depart, showToast, t]);

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isLoading && !sheet) {
    return (
      <AppScreen>
        <View style={{ padding: theme.spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </AppScreen>
    );
  }

  if (query.isError && !sheet) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <View style={{ padding: theme.spacing.lg }}>
          <BackButton onPress={goBack} />
        </View>
        <ErrorState
          title={t('mobile.deliveryLoad.errorTitle')}
          description={t('mobile.deliveryLoad.errorBody')}
          retryLabel={t('mobile.deliveryLoad.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!sheet) {
    return (
      <AppScreen>
        <EmptyState
          title={t('mobile.deliveryLoad.notFoundTitle')}
          description={t('mobile.deliveryLoad.notFoundBody')}
        />
      </AppScreen>
    );
  }

  const dealer = localizedName(locale, sheet.customer);
  const ratio =
    sheet.loadProgress.total > 0
      ? Math.min(1, sheet.loadProgress.loaded / sheet.loadProgress.total)
      : 0;

  return (
    <AppScreen edges={{ top: true }} padding="md">
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isLoading}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.md,
          }}
        >
          <BackButton onPress={goBack} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={deliverySectionLabelStyle(locale, colors.brand)}
            >
              {sheet.number}
            </AppText>
            <AppText variant="title" weight="semibold" numberOfLines={1} align="start">
              {t('mobile.deliveryLoad.sheetTitle')}
            </AppText>
          </View>
        </View>

        <View
          style={{
            borderRadius: theme.radius.xl,
            overflow: 'hidden',
            backgroundColor: DELIVERY_FLOOR_CHARCOAL,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            marginBottom: theme.spacing.lg,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View style={{ minHeight: 220, width: '100%', justifyContent: 'flex-end' }}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.18,
              }}
            >
              <Ionicons
                name={departed ? 'navigate-outline' : 'cube-outline'}
                size={100}
                color={DELIVERY_FLOOR_CREAM}
              />
            </View>
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            >
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <SvgGradient id="loadSheetScrim" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={DELIVERY_FLOOR_CHARCOAL} stopOpacity="0.2" />
                    <Stop offset="1" stopColor={DELIVERY_FLOOR_CHARCOAL} stopOpacity="0.92" />
                  </SvgGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#loadSheetScrim)" />
              </Svg>
            </View>

            <View
              style={{
                padding: theme.spacing.lg,
                gap: theme.spacing.md,
                alignItems: isRTL ? 'flex-end' : 'flex-start',
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(20,18,16,0.72)',
                  borderWidth: 1,
                  borderColor: 'rgba(247,244,239,0.16)',
                  paddingHorizontal: theme.spacing.sm + 2,
                  paddingVertical: 5,
                  borderRadius: theme.radius.full,
                }}
              >
                <Ionicons
                  name={
                    humanPhase.phase === 'delivered' || humanPhase.phase === 'shipped'
                      ? 'checkmark-circle'
                      : humanPhase.phase === 'attention'
                        ? 'alert-circle'
                        : 'cube-outline'
                  }
                  size={12}
                  color={
                    humanPhase.phase === 'attention'
                      ? colors.warning
                      : departed
                        ? colors.success
                        : colors.brand
                  }
                />
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: DELIVERY_FLOOR_CREAM, fontSize: 11 }}
                >
                  {phaseLabel}
                </AppText>
              </View>
              {phaseWhy ? (
                <AppText
                  variant="caption"
                  style={{
                    color: colors.warning,
                    textAlign: isRTL ? 'right' : 'left',
                    backgroundColor: 'rgba(20,18,16,0.72)',
                    paddingHorizontal: theme.spacing.sm + 2,
                    paddingVertical: 5,
                    borderRadius: theme.radius.md,
                    overflow: 'hidden',
                  }}
                >
                  {phaseWhy}
                </AppText>
              ) : null}

              <View style={{ gap: theme.spacing.xs, width: '100%' }}>
                <AppText
                  variant="title"
                  weight="semibold"
                  numberOfLines={2}
                  align="start"
                  style={{ color: DELIVERY_FLOOR_CREAM, fontSize: 22, lineHeight: 28 }}
                >
                  {dealer}
                </AppText>
                {sheet.salesOrder?.number ? (
                  <AppText
                    variant="bodySecondary"
                    align="start"
                    style={{ color: 'rgba(247,244,239,0.88)' }}
                  >
                    {t('mobile.deliveryLoad.orderLabel', {
                      number: sheet.salesOrder.number,
                    })}
                  </AppText>
                ) : null}
              </View>

              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.xs,
                  alignItems: 'flex-start',
                  width: '100%',
                }}
              >
                <Ionicons name="location-outline" size={16} color="rgba(247,244,239,0.7)" />
                <AppText
                  variant="caption"
                  style={{ flex: 1, color: 'rgba(247,244,239,0.78)' }}
                  align="start"
                >
                  {sheet.deliveryAddress}
                </AppText>
              </View>

              <View
                style={{
                  width: '100%',
                  gap: 8,
                  backgroundColor: 'rgba(247,244,239,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(247,244,239,0.14)',
                  borderRadius: theme.radius.lg,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                }}
              >
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'rgba(247,244,239,0.16)',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(ratio * 100)}%`,
                      height: '100%',
                      backgroundColor: departed ? colors.success : colors.brand,
                      borderRadius: 3,
                    }}
                  />
                </View>
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: 'rgba(247,244,239,0.88)' }}
                >
                  {t('mobile.deliveryLoad.packagesProgress', {
                    loaded: sheet.loadProgress.loaded,
                    total: sheet.loadProgress.total,
                  })}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        <View style={{ marginBottom: theme.spacing.md, gap: 4 }}>
          <AppText
            variant="caption"
            weight="semibold"
            style={deliverySectionLabelStyle(locale, colors.brand)}
          >
            {t('mobile.deliveryLoad.packagesEyebrow')}
          </AppText>
          <AppText variant="title" weight="semibold" align="start">
            {t('mobile.deliveryLoad.packagesSection')}
          </AppText>
          <AppText variant="caption" color="muted" align="start">
            {t('mobile.deliveryLoad.packagesHint')}
          </AppText>
        </View>

        {sheet.products.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              overflow: 'hidden',
              ...theme.elevation.card,
            }}
          >
            <View style={{ height: 3, backgroundColor: colors.brand, opacity: 0.35 }} />
            <View
              style={{
                padding: theme.spacing.xl,
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: colors.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="cube-outline" size={24} color={colors.brand} />
              </View>
              <AppText variant="heading" weight="semibold">
                {t('mobile.deliveryLoad.noPackagesTitle')}
              </AppText>
              <AppText variant="caption" color="secondary" style={{ textAlign: 'center' }}>
                {t('mobile.deliveryLoad.noPackagesBody')}
              </AppText>
            </View>
          </View>
        ) : (
          sheet.products.map((product) => (
            <ProductBoard
              key={product.inventoryLotId}
              product={product}
              locale={locale}
              departed={departed}
              busyPieceId={busyPieceId}
              onToggle={onToggle}
            />
          ))
        )}

        {!departed && sheet.canDepart ? (
          <PrimaryButton
            label={t('mobile.deliveryLoad.departCta')}
            onPress={() => {
              void haptics.selection();
              setDepartConfirmOpen(true);
            }}
            loading={mutations.depart.isPending}
          />
        ) : null}
      </ScrollView>

      <ConfirmationSheet
        open={departConfirmOpen}
        onClose={() => setDepartConfirmOpen(false)}
        title={t('mobile.deliveryLoad.departConfirmTitle')}
        message={t('mobile.deliveryLoad.departConfirmBody')}
        confirmLabel={t('mobile.deliveryLoad.departConfirmCta')}
        cancelLabel={t('mobile.orderDetail.cancel')}
        onConfirm={() => void onDepart()}
      />
    </AppScreen>
  );
}
