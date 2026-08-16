import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { isOwnOrderSchedule } from '@/api/modules/scheduling';
import { ScheduleExplanation } from '@/features/scheduling/components/ScheduleExplanation';
import { useOrderScheduleQuery } from '@/features/scheduling/query';

type Props = {
  productionOrderId: string;
};

export function AdminScheduleStrip({ productionOrderId }: Props) {
  const { user } = useAuth();
  const canRead = can(user, 'schedule.read');
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const query = useOrderScheduleQuery(productionOrderId, canRead);

  if (!canRead || !query.data || isOwnOrderSchedule(query.data)) return null;

  const snapshot = query.data.schedule;

  return (
    <SurfaceCard>
      <View style={{ gap: theme.spacing.sm }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="label" weight="semibold">
            {t('mobile.adminScheduling.orderStrip.title')}
          </AppText>
          {query.data.promiseState ? <StatusBadge status={String(query.data.promiseState)} dot /> : null}
        </View>

        <ScheduleExplanation
          source={{
            requestedDeliveryDate:
              snapshot?.requestedDeliveryDate ?? query.data.productionOrder.requiredDeliveryDate,
            suggestedDeliveryDate: snapshot?.suggestedDeliveryDate,
            committedDeliveryDate:
              snapshot?.committedDeliveryDate ?? query.data.productionOrder.committedDeliveryDate,
            earliestAvailableDate: snapshot?.earliestAvailableDate,
            requestedDateFeasible: snapshot?.requestedDateFeasible,
            unschedulableReason: snapshot?.unschedulableReason,
            materialRisk: snapshot?.materialRisk,
            requiresAdminEstimateReview: snapshot?.requiresAdminEstimateReview,
            scheduleStatus: snapshot?.status,
            promiseState: query.data.promiseState,
            planningMode: snapshot?.planningMode,
            materialReadyAt: snapshot?.materialReadyAt,
            committedCompletionDate: snapshot?.committedCompletionDate,
            productionDeadline: snapshot?.productionDeadline,
            deliveryBufferWorkingDays: snapshot?.deliveryBufferWorkingDays,
            plannedStart: snapshot?.allocations?.[0]?.plannedStart,
            plannedEnd: snapshot?.allocations?.[snapshot.allocations.length - 1]?.plannedEnd,
          }}
          variant="detail"
        />

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.adminScheduling.orderStrip.viewOnBoard')}
          onPress={() => {
            void haptics.selection();
            router.push('/(app)/(admin)/scheduling' as Href);
          }}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            minHeight: 36,
          }}
        >
          <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
            {t('mobile.adminScheduling.orderStrip.viewOnBoard')}
          </AppText>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={14} color={colors.brand} />
        </AnimatedPressable>
      </View>
    </SurfaceCard>
  );
}
