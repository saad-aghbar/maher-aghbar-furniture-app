import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { FinishedLot, SemiFinishedLot } from '@/api/modules/inventory';
import { fgDeliveryStatusLabel } from '../fgFilters';

type WipProps = {
  lot: SemiFinishedLot | FinishedLot;
  index: number;
  animateEnter?: boolean;
  onPress?: () => void;
};

function lotAccent(
  status: string,
  colors: { brand: string; success: string; warning: string; error: string; textMuted: string },
): string {
  switch (status) {
    case 'AVAILABLE':
      return colors.success;
    case 'RESERVED':
    case 'REQUIRES_REVIEW':
    case 'QUARANTINED':
      return colors.warning;
    case 'DAMAGED':
    case 'SCRAPPED':
      return colors.error;
    case 'CONSUMED':
    case 'DELIVERED':
      return colors.success;
    default:
      return colors.brand;
  }
}

function StatPill({
  label,
  value,
  emphasize,
  warning,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  warning?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL, locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'baseline',
        gap: 6,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 5,
        borderRadius: theme.radius.md,
        backgroundColor: warning
          ? colors.warningSoft
          : emphasize
            ? colors.brandSoft
            : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: warning ? colors.warning : colors.border,
      }}
    >
      <AppText
        variant="caption"
        color={warning ? 'warning' : 'muted'}
        weight={locale === 'ar' ? 'regular' : 'medium'}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        color={warning ? 'warning' : emphasize ? 'brand' : 'primary'}
        dir="ltr"
      >
        {value}
      </AppText>
    </View>
  );
}

/** PO identifier — Tumbleweed ink on warm silver, not iOS system grey. */
function PoPill({ label }: { label: string }) {
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 3,
        borderRadius: theme.radius.full,
        backgroundColor: colors.brandSoft,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText
        variant="caption"
        weight="medium"
        dir="ltr"
        numberOfLines={1}
        style={{ color: colors.brandActive, fontSize: 11, lineHeight: 14 }}
      >
        {label}
      </AppText>
    </View>
  );
}

function MetaChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 4,
        maxWidth: '100%',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.md,
        backgroundColor: colors.brandSoft,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={12} color={colors.brand} />
      <AppText
        variant="caption"
        numberOfLines={1}
        style={{ flexShrink: 1, color: colors.brand }}
      >
        {label}
      </AppText>
    </View>
  );
}

/** Producing stage → next consuming stage as one chip so the flow never wraps mid-arrow. */
function StageFlowChip({ from, to }: { from?: string | null; to?: string | null }) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  if (!from && !to) return null;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 5,
        maxWidth: '100%',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.md,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name="construct-outline" size={12} color={colors.textMuted} />
      {from ? (
        <AppText variant="caption" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {from}
        </AppText>
      ) : null}
      {from && to ? (
        <Ionicons
          name={isRTL ? 'arrow-back-outline' : 'arrow-forward-outline'}
          size={12}
          color={colors.brand}
        />
      ) : null}
      {to ? (
        <AppText
          variant="caption"
          color="secondary"
          weight="medium"
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {to}
        </AppText>
      ) : null}
    </View>
  );
}

function MetricCell({
  label,
  value,
  emphasize,
  warning,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  warning?: boolean;
}) {
  const { theme } = useTheme();
  const tone = warning ? 'warning' : emphasize ? 'brand' : value === 0 ? 'muted' : 'primary';

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.xs,
      }}
    >
      <AppText variant="heading" weight="semibold" dir="ltr" align="center" color={tone}>
        {value}
      </AppText>
      <AppText variant="caption" color={tone === 'primary' ? 'muted' : tone} align="center" numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}

function MetricRule() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: colors.border,
        marginVertical: 4,
      }}
    />
  );
}

function ThumbWell({
  imageUrl,
  icon,
  accent,
}: {
  imageUrl?: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}) {
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: 44, height: 44 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name={icon} size={20} color={accent} />
      )}
    </View>
  );
}

export function InventoryWipRow({ lot, index, animateEnter = true, onPress }: WipProps) {
  const { t, isRTL, formatDateTime, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedName(locale, lot.inventoryItem);
  const stageName = lot.stageInstance?.stageDefinition
    ? localizedName(locale, lot.stageInstance.stageDefinition)
    : lot.producingStageNameEn || lot.producingStageNameAr
      ? localizedName(locale, {
          nameEn: lot.producingStageNameEn ?? '',
          nameAr: lot.producingStageNameAr ?? '',
        })
      : null;
  const warehouseName = localizedName(locale, lot.warehouse);
  const orderNumber = lot.productionOrder?.number ?? lot.productionOrderNumber ?? null;
  const sku = lot.inventoryItem.sku?.trim();
  const qty = Number(lot.quantity);
  const accent = lotAccent(lot.status, colors);
  const imageUrl = lot.inventoryItem.product?.imageUrl;
  const chevron = isRTL ? 'chevron-back' : 'chevron-forward';

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={name}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          minHeight: theme.sizes.touch.min * 1.55,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.md,
          paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
          paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
          backgroundColor: colors.surface,
          gap: theme.spacing.sm,
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
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: accent === colors.brand ? 0.55 : 0.9,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.sm,
          }}
        >
          <ThumbWell imageUrl={imageUrl} icon="layers-outline" accent={accent} />
          <View style={{ flex: 1, gap: 4 }}>
            {orderNumber ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <PoPill label={orderNumber} />
                <Ionicons name={chevron} size={14} color={colors.brand} />
              </View>
            ) : null}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: theme.spacing.sm,
              }}
            >
              <AppText variant="body" weight={titleWeight} style={{ flex: 1 }} numberOfLines={2}>
                {name}
              </AppText>
              <StatusBadge
                status={lot.status}
                label={t(`mobile.inventory.lotStatus.${lot.status}`)}
                dot
              />
            </View>
            {sku ? (
              <AppText
                variant="caption"
                numberOfLines={1}
                dir="ltr"
                style={{ color: colors.brand }}
              >
                {sku}
              </AppText>
            ) : null}
          </View>
          <Ionicons name={chevron} size={16} color={colors.textMuted} style={{ marginTop: 4 }} />
        </View>

        {orderNumber || stageName || lot.nextConsumingStageNameEn || lot.nextConsumingStageNameAr || lot.salesOrderNumber ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
              alignItems: 'center',
            }}
          >
            {orderNumber ? <MetaChip icon="document-text-outline" label={orderNumber} /> : null}
            {lot.salesOrderNumber ? (
              <MetaChip icon="briefcase-outline" label={lot.salesOrderNumber} />
            ) : null}
            <StageFlowChip
              from={stageName}
              to={
                lot.nextConsumingStageNameEn || lot.nextConsumingStageNameAr
                  ? localizedName(locale, {
                      nameEn: lot.nextConsumingStageNameEn ?? '',
                      nameAr: lot.nextConsumingStageNameAr ?? '',
                    })
                  : null
              }
            />
            {lot.location ? (
              <MetaChip
                icon="location-outline"
                label={lot.location.name?.trim() || lot.location.code}
              />
            ) : null}
            {lot.qrCode || lot.wipKit?.qrCode ? (
              <MetaChip icon="qr-code-outline" label={lot.qrCode || lot.wipKit!.qrCode} />
            ) : null}
            {'daysWaiting' in lot && typeof lot.daysWaiting === 'number' ? (
              <MetaChip
                icon="time-outline"
                label={t('mobile.inventory.daysWaiting', { days: lot.daysWaiting })}
              />
            ) : null}
            {'deliveryStatus' in lot && !lot.deliveryStatus ? (
              <MetaChip icon="bus-outline" label={t('lifecycle.waitingForTruck')} />
            ) : null}
          </View>
        ) : null}

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <StatPill
            label={t('mobile.inventory.onHandShort')}
            value={String(qty)}
            emphasize
          />
          <View
            style={{
              flex: 1,
              minWidth: 120,
              alignItems: isRTL ? 'flex-start' : 'flex-end',
              gap: 2,
            }}
          >
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ color: colors.brand, opacity: 0.72 }}
            >
              {warehouseName}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="time-outline" size={12} color={colors.brand} style={{ opacity: 0.72 }} />
              <AppText
                variant="caption"
                numberOfLines={1}
                style={{ color: colors.brand, opacity: 0.72 }}
              >
                {formatDateTime(lot.producedAt)}
              </AppText>
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}

type FgProps = {
  name: string;
  sku: string;
  available: number;
  reserved: number;
  quarantined?: boolean;
  imageUrl?: string | null;
  index: number;
  onPress?: () => void;
  animateEnter?: boolean;
};

export function InventoryFinishedRow({
  name,
  sku,
  available,
  reserved,
  quarantined,
  imageUrl,
  index,
  onPress,
  animateEnter = true,
}: FgProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const onHand = Math.max(0, available);
  const held = Math.max(0, reserved);
  const free = Math.max(0, onHand - held);
  const empty = onHand <= 0;
  const ready = free > 0 && held <= 0 && !quarantined;
  const accent = quarantined
    ? colors.warning
    : empty
      ? colors.textMuted
      : ready
        ? colors.success
        : colors.brand;
  const chevron = isRTL ? 'chevron-back' : 'chevron-forward';

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={name}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          minHeight: theme.sizes.touch.min * 1.55,
          borderWidth: 1,
          borderColor: quarantined ? colors.warning : colors.borderStrong,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.md,
          paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
          paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
          backgroundColor: colors.surface,
          gap: theme.spacing.md,
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
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: empty && !quarantined ? 0.35 : accent === colors.brand ? 0.55 : 0.9,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.sm,
          }}
        >
          <ThumbWell imageUrl={imageUrl} icon="cube-outline" accent={accent} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="body" weight={titleWeight} numberOfLines={2}>
              {name}
            </AppText>
            {sku ? (
              <AppText variant="caption" color="muted" numberOfLines={1} dir="ltr">
                {sku}
              </AppText>
            ) : null}
            {quarantined ? (
              <StatusBadge
                status="QUARANTINED"
                label={t('mobile.inventory.lotStatus.QUARANTINED')}
                dot
              />
            ) : ready ? (
              <StatusBadge status="READY" label={t('mobile.inventory.lotStatus.READY')} dot />
            ) : null}
          </View>
          <Ionicons name={chevron} size={16} color={colors.textMuted} style={{ marginTop: 4 }} />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'stretch',
            borderRadius: theme.radius.md,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.xs,
          }}
        >
          <MetricCell label={t('inventory.onHand')} value={onHand} />
          <MetricRule />
          <MetricCell label={t('inventory.reserved')} value={held} />
          <MetricRule />
          <MetricCell
            label={t('inventory.available')}
            value={free}
            emphasize={free > 0 && !quarantined}
            warning={quarantined && free > 0}
          />
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}

type FgLotProps = {
  lot: FinishedLot;
  index: number;
  animateEnter?: boolean;
  onPress?: () => void;
};

/** Finished-goods lot row — order/dealer/delivery context, not WIP stage flow. */
export function InventoryFgLotRow({ lot, index, animateEnter = true, onPress }: FgLotProps) {
  const { t, isRTL, formatDate, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const productName =
    lot.productNameEn || lot.productNameAr
      ? localizedName(locale, {
          nameEn: lot.productNameEn ?? '',
          nameAr: lot.productNameAr ?? '',
        })
      : localizedName(locale, lot.inventoryItem);
  const dealerName =
    lot.dealerNameEn || lot.dealerNameAr
      ? localizedName(locale, {
          nameEn: lot.dealerNameEn ?? '',
          nameAr: lot.dealerNameAr ?? '',
        })
      : null;
  const imageUrl = lot.inventoryItem.product?.imageUrl;
  const qty = Number(lot.quantity);
  const accent = lotAccent(lot.status, colors);
  const chevron = isRTL ? 'chevron-back' : 'chevron-forward';
  const waitingForTruck = !lot.deliveryStatus;
  const statusLabel = fgDeliveryStatusLabel(lot, t);

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={productName}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          minHeight: theme.sizes.touch.min * 1.65,
          borderWidth: 1,
          borderColor: waitingForTruck ? colors.warning : colors.borderStrong,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.md,
          paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
          paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
          backgroundColor: colors.surface,
          gap: theme.spacing.sm,
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
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: waitingForTruck ? colors.warning : accent,
            opacity: waitingForTruck || accent !== colors.brand ? 0.9 : 0.55,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.sm,
          }}
        >
          <ThumbWell imageUrl={imageUrl} icon="cube-outline" accent={accent} />
          <View style={{ flex: 1, gap: 4 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: theme.spacing.sm,
              }}
            >
              <AppText variant="body" weight={titleWeight} style={{ flex: 1 }} numberOfLines={2}>
                {productName}
              </AppText>
              {statusLabel ? (
                <StatusBadge
                  status={lot.deliveryStatus ?? 'WAITING'}
                  label={statusLabel}
                  dot
                />
              ) : null}
            </View>
            {lot.projectName ? (
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {lot.projectName}
              </AppText>
            ) : null}
          </View>
          <Ionicons name={chevron} size={16} color={colors.textMuted} style={{ marginTop: 4 }} />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.xs,
            alignItems: 'center',
          }}
        >
          {lot.salesOrderNumber ? (
            <MetaChip icon="briefcase-outline" label={lot.salesOrderNumber} />
          ) : null}
          {lot.productionOrderNumber ?? lot.productionOrder?.number ? (
            <MetaChip
              icon="document-text-outline"
              label={lot.productionOrderNumber ?? lot.productionOrder?.number ?? ''}
            />
          ) : null}
          {dealerName ? <MetaChip icon="people-outline" label={dealerName} /> : null}
          <MetaChip
            icon="shield-checkmark-outline"
            label={
              String(lot.qcStatus ?? 'PASS').toUpperCase().includes('FAIL')
                ? t('lifecycle.qcFailed')
                : t('lifecycle.qcPassed')
            }
          />
          {lot.packagingComplete !== false ? (
            <MetaChip icon="cube-outline" label={t('lifecycle.packagingComplete')} />
          ) : null}
          {lot.deliveryNumber ? (
            <MetaChip icon="car-outline" label={lot.deliveryNumber} />
          ) : null}
          {typeof lot.daysWaiting === 'number' ? (
            <MetaChip
              icon="time-outline"
              label={t('mobile.inventory.daysWaiting', { days: lot.daysWaiting })}
            />
          ) : null}
          {lot.deliveryDate ? (
            <MetaChip icon="calendar-outline" label={formatDate(lot.deliveryDate)} />
          ) : null}
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <StatPill label={t('mobile.inventory.onHandShort')} value={String(qty)} emphasize />
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {localizedName(locale, lot.warehouse)}
          </AppText>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
