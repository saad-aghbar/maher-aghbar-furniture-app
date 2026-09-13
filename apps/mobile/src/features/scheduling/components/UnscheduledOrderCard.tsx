import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { OrderCardMedia } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import type { UnscheduledOrderCard as UnscheduledOrder } from '@/api/modules/scheduling';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { canScheduleOrder, minutesLabel } from '../selectFactoryTower';

type Props = {
  order: UnscheduledOrder;
  onSchedule: () => void;
  onOpen: () => void;
};

export function UnscheduledOrderCardView({ order, onSchedule, onOpen }: Props) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const title =
    locale === 'ar'
      ? order.product?.nameAr ?? order.productDescription
      : locale === 'he'
        ? order.product?.nameHe ?? order.productDescription
        : order.product?.nameEn ?? order.productDescription;
  const schedulable = canScheduleOrder(order.planningState);

  return (
    <AnimatedPressable
      variant="card"
      onPress={() => {
        void haptics.selection();
        onOpen();
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
          backgroundColor: schedulable ? colors.brand : colors.warning,
          opacity: schedulable ? 0.55 : 0.9,
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
          status={order.planningState}
          label={t(`mobile.adminScheduling.planningState.${order.planningState}`)}
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
        <OrderCardMedia imageUrl={order.product?.imageUrl ?? null} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText weight={titleWeight} dir="ltr">
            {order.number}
          </AppText>
          <AppText numberOfLines={2}>{title}</AppText>
          {order.dealerName ? (
            <AppText variant="caption" color="secondary">
              {order.dealerName}
            </AppText>
          ) : null}
          {order.requiredDeliveryDate || order.committedDeliveryDate ? (
            <AppText variant="caption" color="secondary">
              {t('mobile.adminScheduling.requiredBy', {
                date: formatDate(order.committedDeliveryDate ?? order.requiredDeliveryDate ?? ''),
              })}
            </AppText>
          ) : null}
          <AppText variant="caption" color="secondary">
            {t('mobile.adminScheduling.unscheduled.planChecks', {
              workflow: order.workflowReady
                ? t('mobile.adminScheduling.unscheduled.ready')
                : t('mobile.adminScheduling.unscheduled.missing'),
              durations: order.durationsReady
                ? t('mobile.adminScheduling.unscheduled.ready')
                : t('mobile.adminScheduling.unscheduled.missing'),
            })}
          </AppText>
          {order.stages.slice(0, 4).map((stage) => (
            <AppText key={stage.taskId} variant="caption" dir="ltr">
              {`${stage.nameEn ?? stage.code ?? '—'} · ${minutesLabel(stage.estimatedMinutes ?? 0)}`}
            </AppText>
          ))}
        </View>
      </View>
      {schedulable ? (
        <View style={{ padding: theme.spacing.md, paddingTop: 0 }}>
          <AnimatedPressable
            variant="button"
            onPress={() => {
              void haptics.selection();
              onSchedule();
            }}
            style={{
              minHeight: 44,
              borderRadius: theme.radius.xl,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText weight={titleWeight} style={{ color: colors.onBrand }}>
              {t('mobile.adminScheduling.scheduleOrder.action')}
            </AppText>
          </AnimatedPressable>
        </View>
      ) : (
        <View style={{ padding: theme.spacing.md, paddingTop: 0 }}>
          <AppText variant="caption" color="secondary">
            {t('mobile.adminScheduling.unscheduled.needsPlanningHint')}
          </AppText>
        </View>
      )}
    </AnimatedPressable>
  );
}
