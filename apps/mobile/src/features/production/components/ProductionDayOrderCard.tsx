import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ProductThumb } from '@/components/desk';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionOrderListItem } from '../api';
import { productionFloorStatusLabel, selectProductionCard } from '../selectProduction';
import { productionInsetStyle } from '../productionFloorStyle';

type Props = {
  order: ProductionOrderListItem;
  onPress: () => void;
};

function eventLabel(
  kind: string,
  t: (key: string) => string,
): string {
  const key = `mobile.production.dayLens.event.${kind}`;
  const label = t(key);
  return label === key ? kind.replace(/_/g, ' ') : label;
}

/**
 * Order-centric day lens card — planned windows or actual events for the selected day.
 */
export function ProductionDayOrderCard({ order, onPress }: Props) {
  const { t, locale, isRTL, formatDateTime } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const card = selectProductionCard(order, locale);
  const lens = order.dayLens;
  const soPo = [order.salesOrder?.number, order.number].filter(Boolean).join(' · ');

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: card.isLate ? colors.error : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <StatusBadge
          status={order.status}
          dot
          label={productionFloorStatusLabel(order.status, t('mobile.production.inProduction'))}
        />
        {card.isLate ? (
          <AppText variant="caption" style={{ color: colors.error }}>
            {t('mobile.production.late')}
          </AppText>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
        }}
      >
        <ProductThumb uri={card.imageUrl} size={72} radius={14} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <AppText variant="label" weight={titleWeight} numberOfLines={2}>
            {card.title}
          </AppText>
          {soPo ? (
            <AppText variant="caption" color="muted" dir="ltr">
              {soPo}
            </AppText>
          ) : null}
          {card.dealerName ? (
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {card.dealerName}
            </AppText>
          ) : null}
          {card.deliveryLabel ? (
            <AppText variant="caption" color="muted">
              {t('mobile.production.deliveryDate')}: {card.deliveryLabel}
            </AppText>
          ) : null}

          <View style={productionInsetStyle(theme, colors)}>
            {lens?.mode === 'planned'
              ? (lens.plannedTasks ?? []).map((task) => {
                  const stage =
                    locale === 'ar'
                      ? task.stageNameAr || task.stageNameEn
                      : locale === 'he'
                        ? task.stageNameHe || task.stageNameEn
                        : task.stageNameEn;
                  const window = [
                    task.plannedStart
                      ? formatDateTime(task.plannedStart)
                      : '—',
                    task.plannedCompletion
                      ? formatDateTime(task.plannedCompletion)
                      : '—',
                  ].join(' → ');
                  return (
                    <View key={task.taskId} style={{ marginBottom: 6, gap: 2 }}>
                      <AppText variant="caption" weight={titleWeight}>
                        {stage}
                        {task.workerName ? ` · ${task.workerName}` : ''}
                      </AppText>
                      <AppText variant="caption" color="muted" dir="ltr">
                        {window}
                      </AppText>
                    </View>
                  );
                })
              : null}
            {lens?.mode === 'actual'
              ? (lens.events ?? []).map((ev, i) => (
                  <View key={`${ev.kind}:${ev.at}:${i}`} style={{ marginBottom: 6, gap: 2 }}>
                    <AppText variant="caption" weight={titleWeight}>
                      {eventLabel(ev.kind, t)}
                      {ev.stage ? ` · ${ev.stage}` : ''}
                      {ev.worker ? ` · ${ev.worker}` : ''}
                    </AppText>
                    <AppText variant="caption" color="muted" dir="ltr">
                      {formatDateTime(ev.at)}
                    </AppText>
                  </View>
                ))
              : null}
            {!lens?.plannedTasks?.length && !lens?.events?.length ? (
              <AppText variant="caption" color="muted">
                —
              </AppText>
            ) : null}
          </View>

          {card.readinessReason && !/^[A-Z][A-Z0-9_]{2,}$/.test(card.readinessReason) ? (
            <AppText variant="caption" style={{ color: colors.warning }} numberOfLines={2}>
              {card.readinessReason}
            </AppText>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}
