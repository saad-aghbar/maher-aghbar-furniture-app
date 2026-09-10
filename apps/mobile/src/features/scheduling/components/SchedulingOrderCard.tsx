import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { OrderCardMedia } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import type { ScheduleOrderCard } from '@/api/modules/scheduling';
import { formatTimeRange, useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  order: ScheduleOrderCard;
  onPress: () => void;
};

export function SchedulingOrderCard({ order, onPress }: Props) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const title =
    locale === 'ar'
      ? order.productNameAr ?? order.productName
      : locale === 'he'
        ? order.productNameHe ?? order.productName
        : order.productName;
  const dealer =
    locale === 'ar'
      ? order.dealerNameAr ?? order.dealerName
      : locale === 'he'
        ? order.dealerNameHe ?? order.dealerName
        : order.dealerName;
  const late = Boolean(order.hasConflict || order.materialRisk);

  return (
    <AnimatedPressable
      variant="card"
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
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
          backgroundColor: late ? colors.error : colors.brand,
          opacity: late ? 0.9 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <StatusBadge
          status={order.status ?? 'SCHEDULED'}
          label={order.status ?? t('mobile.adminScheduling.orderCard.scheduled')}
          dot
        />
        <AppText variant="caption" color="secondary">
          {t('mobile.adminScheduling.orderCard.details')}
        </AppText>
      </View>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <OrderCardMedia imageUrl={order.imageUrl ?? null} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText weight={titleWeight} dir="ltr">
            {order.number}
          </AppText>
          <AppText numberOfLines={2}>{title}</AppText>
          {dealer ? (
            <AppText variant="caption" color="secondary">
              {dealer}
            </AppText>
          ) : null}
          {order.plannedStart && order.plannedEnd ? (
            <AppText variant="caption" dir="ltr">
              {formatTimeRange(locale, order.plannedStart, order.plannedEnd)}
            </AppText>
          ) : null}
          {order.committedDeliveryDate || order.requestedDeliveryDate ? (
            <AppText variant="caption" color="secondary">
              {t('mobile.adminScheduling.requiredBy', {
                date: formatDate(order.committedDeliveryDate ?? order.requestedDeliveryDate ?? ''),
              })}
            </AppText>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}
