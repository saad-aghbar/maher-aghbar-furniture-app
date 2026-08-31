import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import type { WipKitCard } from '@/api/modules/inventory';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { semiKitFloorStatus, type SemiKitFloorStatus } from '../selectSemiOrders';

type Props = {
  kit: WipKitCard;
  index?: number;
  animateEnter?: boolean;
  /** When false, hide the PO number chip (order screen already shows it). */
  showOrderNumber?: boolean;
  /** Horizontal row for order detail — full width, no tall media crop. */
  compact?: boolean;
  /** Nested inside a stage board — no outer shell/shadow. */
  embedded?: boolean;
  onPress?: () => void;
};

const MEDIA_ASPECT = 1.28;

function localizedProduct(kit: WipKitCard, locale: string): string {
  const p = kit.productionOrder.product;
  if (!p) return kit.productionOrder.productDescription;
  if (locale === 'ar') return p.nameAr || p.nameEn;
  if (locale === 'he') return p.nameHe || p.nameEn;
  return p.nameEn || p.nameAr;
}

function localizedStage(kit: WipKitCard, locale: string): string {
  const s = kit.stageInstance.stageDefinition;
  if (locale === 'ar') return s.nameAr || s.nameEn;
  if (locale === 'he') return s.nameHe || s.nameEn;
  return s.nameEn;
}

function floorStatusLabel(
  status: SemiKitFloorStatus,
  t: (key: string) => string,
): string {
  if (status === 'at_station') return t('mobile.inventory.semiFloorAtStation');
  if (status === 'in_warehouse') return t('mobile.inventory.semiFloorInWarehouse');
  if (status === 'received') return t('mobile.inventory.semiFloorReceived');
  if (status === 'used') return t('mobile.inventory.semiFloorUsed');
  return t('mobile.inventory.semiFloorCancelled');
}

/**
 * Semi kit card — stage piece with plain floor status + warehouse/bin.
 */
export function InventorySemiOrderCard({
  kit,
  index = 0,
  animateEnter = true,
  showOrderNumber = true,
  compact = false,
  embedded = false,
  onPress,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedProduct(kit, locale);
  const stageName = localizedStage(kit, locale);
  const bin = kit.location?.name?.trim() || kit.location?.code || null;
  const warehouseName = kit.warehouse
    ? localizedName(locale, kit.warehouse, kit.warehouse.code)
    : null;
  const qty = kit.pieces.find((p) => p.inventoryLot)?.inventoryLot?.quantity;
  const floor = semiKitFloorStatus(kit);
  const productUri = resolveOrderMediaUri(kit.productionOrder.product?.imageUrl);
  const photoDocId =
    kit.pieces.find((p) => p.photoDocumentId)?.photoDocumentId ??
    kit.pieces.find((p) => p.photoDocument?.id)?.photoDocument?.id ??
    null;
  const [workerUri, setWorkerUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!photoDocId) {
      setWorkerUri(null);
      return;
    }
    void resolveDocumentUrl(photoDocId)
      .then((url) => {
        if (!cancelled) setWorkerUri(url);
      })
      .catch(() => {
        if (!cancelled) setWorkerUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [photoDocId]);

  const mediaUri = workerUri || productUri;
  const statusStamp =
    floor === 'received'
      ? {
          soft: colors.warningSoft,
          ink: colors.warning,
          label: floorStatusLabel(floor, t),
        }
      : floor === 'used' || floor === 'cancelled'
        ? {
            soft: colors.surfaceSecondary,
            ink: colors.textSecondary,
            label: floorStatusLabel(floor, t),
          }
        : floor === 'in_warehouse'
          ? {
              soft: colors.successSoft,
              ink: colors.success,
              label: floorStatusLabel(floor, t),
            }
          : {
              soft: colors.brandSoft,
              ink: colors.brand,
              label: floorStatusLabel(floor, t),
            };
  const accent = statusStamp.ink;
  const borderColor =
    floor === 'received' ? colors.warning : colors.borderStrong;
  const placeLine = [warehouseName, bin ? t('mobile.inventory.semiFloorBin', { bin }) : null]
    .filter(Boolean)
    .join(' · ');
  const custodyLine = placeLine
    ? t('mobile.inventory.semiCustodyLine', { place: placeLine })
    : null;
  const fadeBottom = colorScheme === 'dark' ? 0.72 : 0.58;
  const makerEmp = kit.producingTask?.assignedEmployee;
  const makerName = makerEmp
    ? `${makerEmp.firstName} ${makerEmp.lastName}`.trim()
    : null;
  const takerName = kit.claimedByUser
    ? `${kit.claimedByUser.firstName} ${kit.claimedByUser.lastName}`.trim()
    : null;
  const hasWorkers = Boolean(makerName || takerName);

  if (compact) {
    const shell = embedded
      ? {
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden' as const,
          marginBottom: 0,
          ...theme.elevation.rest,
        }
      : {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.surface,
          overflow: 'hidden' as const,
          marginBottom: theme.spacing.sm + 4,
          ...orderBoardShadow(colorScheme),
        };

    return (
      <ListItemEnter index={index} enabled={animateEnter && !embedded}>
        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={`${kit.productionOrder.number} ${name}`}
          onPress={() => {
            void haptics.selection();
            onPress?.();
          }}
          style={shell}
        >
          {!embedded ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                width: 3,
                backgroundColor: accent,
                opacity: 0.9,
              }}
            />
          ) : null}

          {/* Status band */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: embedded ? theme.spacing.sm : theme.spacing.sm,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + (embedded ? 0 : 4) }
                : { paddingLeft: theme.spacing.md + (embedded ? 0 : 4) }),
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
              backgroundColor: statusStamp.soft,
            }}
          >
            <View
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: statusStamp.ink,
                maxWidth: '78%',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                numberOfLines={1}
                style={{ color: statusStamp.ink, fontSize: 11 }}
              >
                {statusStamp.label}
              </AppText>
            </View>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <AppText variant="caption" color="brand" weight="semibold" numberOfLines={1}>
                {t('mobile.inventory.semiOpenOrder')}
              </AppText>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={14}
                color={colors.brand}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: embedded ? 72 : 84,
                height: embedded ? 72 : 84,
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.borderStrong,
              }}
            >
              {mediaUri ? (
                <Image
                  source={{ uri: mediaUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.brandSoft,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="layers-outline" size={18} color={colors.brand} />
                  </View>
                </View>
              )}
            </View>

            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <AppText
                variant="body"
                weight={titleWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {name}
              </AppText>

              {(custodyLine || qty != null || hasWorkers) ? (
                <View
                  style={{
                    borderRadius: theme.radius.md,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    paddingHorizontal: theme.spacing.sm + 2,
                    paddingVertical: theme.spacing.sm,
                    gap: 3,
                  }}
                >
                  {custodyLine ? (
                    <AppText
                      variant="caption"
                      color="secondary"
                      numberOfLines={1}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {custodyLine}
                    </AppText>
                  ) : null}
                  {qty != null ? (
                    <AppText
                      variant="caption"
                      weight="semibold"
                      style={{
                        color: colors.brand,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {t('mobile.inventory.semiOnHand', { qty: String(qty) })}
                    </AppText>
                  ) : null}
                  {makerName ? (
                    <AppText
                      variant="caption"
                      color="muted"
                      numberOfLines={1}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t('mobile.inventory.semiMadeBy')}: {makerName}
                    </AppText>
                  ) : null}
                  {takerName ? (
                    <AppText
                      variant="caption"
                      color="muted"
                      numberOfLines={1}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t('mobile.inventory.semiTookBy')}: {takerName}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </AnimatedPressable>
      </ListItemEnter>
    );
  }

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${kit.productionOrder.number} ${name}`}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          marginBottom: theme.spacing.sm + 4,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: floor === 'received' ? 0.95 : 0.65,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              flex: 1,
              minWidth: 0,
            }}
          >
            {showOrderNumber ? (
              <View
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: theme.radius.full,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  maxWidth: '40%',
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  numberOfLines={1}
                  dir="ltr"
                  style={{
                    color: colors.brand,
                    fontSize: 11,
                    letterSpacing: locale === 'ar' ? 0 : 0.4,
                  }}
                >
                  {kit.productionOrder.number}
                </AppText>
              </View>
            ) : null}
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: statusStamp.soft,
                borderWidth: 1,
                borderColor: statusStamp.ink,
                maxWidth: showOrderNumber ? '55%' : '90%',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                numberOfLines={1}
                style={{ color: statusStamp.ink, fontSize: 11 }}
              >
                {statusStamp.label}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color="brand" weight="semibold" numberOfLines={1}>
            {t('mobile.inventory.semiOpenOrder')}
          </AppText>
        </View>

        <View style={{ paddingHorizontal: theme.spacing.md, marginTop: theme.spacing.sm + 2 }}>
          <View
            style={{
              aspectRatio: MEDIA_ASPECT,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
            }}
          >
            {mediaUri ? (
              <Image
                source={{ uri: mediaUri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="layers-outline" size={20} color={colors.brand} />
                </View>
              </View>
            )}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' }}
            >
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <SvgGradient id={`semiFade-${kit.id}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.surface} stopOpacity="0" />
                    <Stop offset="1" stopColor={colors.surface} stopOpacity={fadeBottom} />
                  </SvgGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#semiFade-${kit.id})`} />
              </Svg>
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: theme.spacing.sm,
                ...(isRTL ? { right: theme.spacing.sm } : { left: theme.spacing.sm }),
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText variant="caption" weight="semibold" numberOfLines={1}>
                {stageName}
              </AppText>
            </View>
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            gap: 4,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          }}
        >
          <AppText
            variant="body"
            weight={titleWeight}
            numberOfLines={2}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {name}
          </AppText>
          {custodyLine ? (
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {custodyLine}
            </AppText>
          ) : null}
          {qty != null ? (
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.inventory.semiOnHand', { qty: String(qty) })}
            </AppText>
          ) : null}
          {makerName ? (
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.inventory.semiMadeBy')}: {makerName}
            </AppText>
          ) : null}
          {takerName ? (
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.inventory.semiTookBy')}: {takerName}
            </AppText>
          ) : null}
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
