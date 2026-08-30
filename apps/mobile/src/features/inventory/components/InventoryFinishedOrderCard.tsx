import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { AppText } from '@/components/AppText';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { fgLeaveByLabel, fgLeaveUrgency } from '../fgFilters';
import type { FinishedOrderGroup } from '../selectFinishedOrders';

type Props = {
  order: FinishedOrderGroup;
  index?: number;
  animateEnter?: boolean;
  onPress?: () => void;
};

const MEDIA_ASPECT = 1.28;

function productName(order: FinishedOrderGroup, locale: string): string {
  if (locale === 'ar') return order.productNameAr || order.productNameEn;
  if (locale === 'he') return order.productNameHe || order.productNameEn;
  return order.productNameEn || order.productNameAr;
}

function dealerName(order: FinishedOrderGroup, locale: string): string {
  if (locale === 'ar') return order.dealerNameAr || order.dealerNameEn || '—';
  if (locale === 'he') return order.dealerNameHe || order.dealerNameEn || '—';
  return order.dealerNameEn || order.dealerNameAr || '—';
}

/**
 * Finished Goods outbound order card — SO-grouped, packages + leave-by primary.
 */
export function InventoryFinishedOrderCard({
  order,
  index = 0,
  animateEnter = true,
  onPress,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = productName(order, locale);
  const dealer = dealerName(order, locale);
  const mediaUri = resolveOrderMediaUri(order.productImageUrl);
  const fadeBottom = colorScheme === 'dark' ? 0.72 : 0.58;
  const urgency = fgLeaveUrgency({
    deliveryStatus: order.deliveryStatus,
    deliveryDate: order.deliveryDate,
  });
  const leaveLabel = fgLeaveByLabel(
    { deliveryStatus: order.deliveryStatus, deliveryDate: order.deliveryDate },
    t,
  );
  const accent =
    urgency === 'overdue'
      ? colors.error
      : urgency === 'leavingToday'
        ? colors.warning
        : colors.brand;
  const borderColor = urgency === 'overdue' ? colors.error : colors.borderStrong;

  const packageLine = order.packageSummary
    ? t('mobile.inventory.fgPackagesLine', {
        count: order.packageCount,
        summary: order.packageSummary,
      })
    : t('mobile.inventory.fgPackagesCount', { count: order.packageCount });
  const warehouseLine = order.multiWarehouse
    ? t('mobile.inventory.fgMultiWarehouses', { count: order.warehouseIds.length })
    : order.warehouseLabels[0] || null;
  const poLine = order.productionOrderNumbers.join(', ') || null;
  const loadLine =
    order.loadTotal > 0
      ? t('mobile.inventory.fgLoadProgress', {
          checked: order.loadChecked,
          total: order.loadTotal,
        })
      : null;

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${order.salesOrderNumber} ${name}`}
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
          marginBottom: theme.spacing.sm + 6,
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
            opacity: 0.85,
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
            <View
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                maxWidth: '55%',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                numberOfLines={1}
                dir="ltr"
                style={{ color: colors.brand, fontSize: 11 }}
              >
                {order.salesOrderNumber}
              </AppText>
            </View>
            {poLine ? (
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={1}
                dir="ltr"
                style={{ flexShrink: 1, fontSize: 11 }}
              >
                {poLine}
              </AppText>
            ) : null}
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
              maxWidth: '42%',
            }}
          >
            <Ionicons
              name={urgency === 'overdue' ? 'alert-circle' : 'time-outline'}
              size={14}
              color={accent}
            />
            <AppText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              style={{ color: accent, fontSize: 11 }}
            >
              {leaveLabel}
            </AppText>
          </View>
        </View>

        <View style={{ width: '100%', aspectRatio: MEDIA_ASPECT, backgroundColor: colors.surfaceSecondary }}>
          {mediaUri ? (
            <Image
              source={{ uri: mediaUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="cube-outline" size={24} color={colors.brand} />
              </View>
            </View>
          )}
          <Svg
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' }}
            width="100%"
            height="100%"
          >
            <Defs>
              <SvgGradient id="fgFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.surface} stopOpacity="0" />
                <Stop offset="1" stopColor={colors.surface} stopOpacity={fadeBottom} />
              </SvgGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#fgFade)" />
          </Svg>
        </View>

        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
            gap: 6,
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
            {order.projectName || name}
          </AppText>
          <AppText
            variant="bodySecondary"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left', color: colors.textSecondary }}
          >
            {dealer}
          </AppText>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 6,
              marginTop: 2,
            }}
          >
            <Ionicons name="cube-outline" size={15} color={colors.brand} style={{ marginTop: 1 }} />
            <AppText
              variant="caption"
              weight="medium"
              numberOfLines={2}
              style={{ flex: 1, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
            >
              {packageLine}
            </AppText>
          </View>

          {warehouseLine ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={1}
                style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
              >
                {warehouseLine}
              </AppText>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              marginTop: 4,
            }}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.inventory.qtyOnHand', { qty: order.unitsOnHand })}
            </AppText>
            {order.daysWaiting > 0 ? (
              <AppText variant="caption" color="muted">
                {t('mobile.inventory.daysWaiting', { days: order.daysWaiting })}
              </AppText>
            ) : null}
            {loadLine ? (
              <AppText variant="caption" weight="medium" style={{ color: colors.info }}>
                {loadLine}
              </AppText>
            ) : null}
          </View>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
