import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { OrderCardMedia } from '@/features/sales-orders/components/OrderCardMedia';
import type { ScheduleOrderCard } from '@/api/modules/scheduling';
import type { ProductionTaskRow } from '@/features/production/selectProduction';
import { formatTimeRange, useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type SchedulingOrderAction = 'approve' | 'changeDate' | 'overwrite' | 'locked';

type Props = {
  open: boolean;
  onClose: () => void;
  order: ScheduleOrderCard | null;
  action: SchedulingOrderAction;
  canApprove?: boolean;
  canOverwrite?: boolean;
  onApprove?: () => void;
  onChangeDate?: () => void;
  onOverwriteApproval?: () => void;
  tasks?: ProductionTaskRow[];
  onOpenTask?: (task: ProductionTaskRow) => void;
};

export function SchedulingOrderSheet({
  open,
  onClose,
  order,
  action,
  canApprove,
  canOverwrite,
  onApprove,
  onChangeDate,
  onOverwriteApproval,
  tasks = [],
  onOpenTask,
}: Props) {
  const { t, locale, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const title =
    locale === 'ar'
      ? order?.productNameAr ?? order?.productName
      : locale === 'he'
        ? order?.productNameHe ?? order?.productName
        : order?.productName;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      expandable
      sheetHeight={Math.round(height * 0.88)}
      title={order?.number ?? t('mobile.adminScheduling.orderCard.title')}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {order ? (
          <>
            <DealerBoard>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <OrderCardMedia imageUrl={order.imageUrl ?? null} size={72} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText weight={titleWeight}>{title}</AppText>
                  <AppText color="secondary">{order.dealerName}</AppText>
                  {order.plannedStart && order.plannedEnd ? (
                    <AppText dir="ltr">
                      {formatTimeRange(locale, order.plannedStart, order.plannedEnd)}
                    </AppText>
                  ) : null}
                  {order.committedDeliveryDate ? (
                    <AppText color="secondary">
                      {t('mobile.adminScheduling.requiredBy', {
                        date: formatDate(order.committedDeliveryDate),
                      })}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </DealerBoard>
            {order.hasConflict ? (
              <DealerBoard title={t('mobile.adminScheduling.conflict')} accentColor={colors.warning}>
                <AppText color="secondary">{order.conflictReason ?? t('mobile.adminScheduling.conflict')}</AppText>
              </DealerBoard>
            ) : null}

            {action === 'approve' ? (
              <View style={{ gap: theme.spacing.sm }}>
                {canApprove ? (
                  <AnimatedPressable
                    variant="button"
                    onPress={() => {
                      void haptics.confirmMedium();
                      onApprove?.();
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
                      {t('mobile.adminScheduling.sheets.approveConfirm')}
                    </AppText>
                  </AnimatedPressable>
                ) : null}
                <AnimatedPressable
                  variant="button"
                  onPress={() => {
                    void haptics.selection();
                    onChangeDate?.();
                  }}
                  style={{
                    minHeight: 44,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppText weight={titleWeight}>{t('mobile.adminScheduling.sheets.changeDateTitle')}</AppText>
                </AnimatedPressable>
              </View>
            ) : null}

            {action === 'overwrite' && canOverwrite ? (
              <AnimatedPressable
                variant="button"
                onPress={() => {
                  void haptics.selection();
                  onOverwriteApproval?.();
                }}
                style={{
                  minHeight: 44,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText weight={titleWeight}>
                  {t('mobile.adminScheduling.sheets.overwriteApprovalConfirm')}
                </AppText>
              </AnimatedPressable>
            ) : null}

            {action === 'locked' ? (
              <DealerBoard title={t('mobile.adminScheduling.sheets.approvedLocked')} titleWeight={titleWeight}>
                <AppText color="secondary">{t('mobile.adminScheduling.sheets.inProductionLocked')}</AppText>
              </DealerBoard>
            ) : null}

            {tasks.length > 0 ? (
              <DealerBoard title={t('mobile.adminScheduling.orderCard.openTasks')}>
                {tasks.map((task) => (
                  <AnimatedPressable
                    key={task.id}
                    variant="card"
                    onPress={() => {
                      void haptics.selection();
                      onOpenTask?.(task);
                    }}
                    style={{
                      minHeight: 44,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSecondary,
                      padding: theme.spacing.md,
                      marginBottom: theme.spacing.sm,
                    }}
                  >
                    <AppText weight={titleWeight}>{task.name}</AppText>
                    {task.plannedStart ? (
                      <AppText variant="caption" color="secondary" dir="ltr">
                        {task.plannedStart.slice(0, 16)}
                      </AppText>
                    ) : null}
                  </AnimatedPressable>
                ))}
              </DealerBoard>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
