import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { OwnOrderSchedule } from '@/api/modules/scheduling';
import { selectChangeDateCta, selectOrderPromiseSummary } from '../selectSchedulePromise';
import {
  DEALER_DATE_FIELD_LABEL_KEY,
  selectDealerDateFields,
  selectDeliveryTimeline,
} from '@/features/scheduling/selectDealerDeliveries';
import { OrderBoardCard, OrderSectionHeader } from './OrderBoardCard';

type Props = {
  schedule: OwnOrderSchedule | null | undefined;
  isLoading?: boolean;
  onChangeDate: () => void;
};

function FieldCaption({ label }: { label: string }) {
  const { isRTL } = useLocale();
  return (
    <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
      {label}
    </AppText>
  );
}

function FieldValue({ value, muted }: { value: string; muted?: boolean }) {
  const { isRTL } = useLocale();
  return (
    <AppText
      variant="body"
      weight="semibold"
      color={muted ? 'muted' : undefined}
      style={{ textAlign: isRTL ? 'right' : 'left' }}
    >
      {value}
    </AppText>
  );
}

const TIMELINE_KEYS = [
  ['received', 'mobile.orderDetail.schedule.timelineReceived'],
  ['confirmed', 'mobile.orderDetail.schedule.timelineConfirmed'],
  ['production', 'mobile.orderDetail.schedule.timelineProduction'],
  ['ready', 'mobile.orderDetail.schedule.timelineReady'],
  ['out', 'mobile.orderDetail.schedule.timelineOut'],
  ['delivered', 'mobile.orderDetail.schedule.timelineDelivered'],
] as const;

/** Dealer-facing promise summary + change-date CTA — never shows factory internals. */
export function OrderScheduleCard({ schedule, isLoading, onChangeDate }: Props) {
  const { t, formatDate, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  if (isLoading) {
    return (
      <OrderBoardCard accent={colors.brand}>
        <OrderSectionHeader
          icon="calendar-outline"
          label={t('mobile.orderDetail.schedule.title')}
        />
        <View
          style={{
            height: 16,
            borderRadius: theme.radius.sm,
            backgroundColor: colors.surfaceSecondary,
            width: '60%',
          }}
        />
      </OrderBoardCard>
    );
  }

  if (!schedule) return null;

  const summary = selectOrderPromiseSummary(schedule);
  const cta = selectChangeDateCta(schedule);
  if (!summary) return null;

  const status = summary.customerStatus ?? summary.promiseState;
  const committed = summary.committedDeliveryDate;
  const requested = summary.requestedDeliveryDate;
  const suggested = summary.suggestedDeliveryDate;
  const projected = summary.projectedDeliveryDate;
  const planned = summary.plannedDeliveryDate;
  const actual = summary.actualDeliveryDate;
  const awaiting = status === 'AWAITING_CONFIRMATION' || summary.showEstimateOnly;
  const delayed = status === 'MAY_BE_DELAYED' || status === 'DELAYED';
  const dateFields = selectDealerDateFields({
    requestedDeliveryDate: requested,
    suggestedDeliveryDate: suggested,
    committedDeliveryDate: committed,
    projectedDeliveryDate: projected,
    plannedDeliveryDate: planned,
    actualDeliveryDate: actual,
  });
  const timeline = selectDeliveryTimeline({
    customerStatus: status,
    committedDeliveryDate: committed,
  });

  return (
    <OrderBoardCard accent={colors.brand}>
      <OrderSectionHeader
        icon="calendar-outline"
        label={t('mobile.orderDetail.schedule.timelineTitle')}
        trailing={<StatusBadge status={String(status)} dot />}
      />

      {summary.compactDates && committed && !delayed ? (
        <FieldValue
          value={t('mobile.orderDetail.schedule.compactOnTrack', {
            date: formatDate(committed),
          })}
        />
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          {awaiting ? (
            <FieldCaption label={t('mobile.orders.notConfirmed')} />
          ) : null}
          {dateFields.map((field) => (
            <View key={field.kind} style={{ gap: 2 }}>
              <FieldCaption label={t(DEALER_DATE_FIELD_LABEL_KEY[field.kind])} />
              <FieldValue value={formatDate(field.ymd)} muted={field.kind === 'requested'} />
            </View>
          ))}
          {dateFields.length === 0 ? (
            <FieldCaption label={t('mobile.orderDetail.schedule.noDateYet')} />
          ) : null}
          {delayed ? (
            <FieldCaption label={t('mobile.orders.productionDelay')} />
          ) : null}
          {delayed && (schedule.scheduleUpdating || !projected) ? (
            <FieldCaption label={t('mobile.orders.scheduleUpdating')} />
          ) : !delayed && schedule.customerSafeReason ? (
            <FieldCaption label={t('mobile.orders.scheduleUpdating')} />
          ) : null}
        </View>
      )}

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
        {timeline.map((step, index) => {
          const labelKey = TIMELINE_KEYS[index]?.[1] ?? '';
          return (
            <View
              key={step.key}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: step.done
                    ? colors.brand
                    : step.current
                      ? colors.warning
                      : colors.border,
                }}
              />
              <AppText
                variant="caption"
                weight={step.current ? 'semibold' : 'regular'}
                color={step.done || step.current ? undefined : 'muted'}
              >
                {t(labelKey)}
              </AppText>
            </View>
          );
        })}
      </View>

      {cta.mode !== 'hidden' ? (
        <SecondaryButton
          label={t(cta.labelKey)}
          onPress={onChangeDate}
          disabled={cta.mode === 'locked'}
        />
      ) : null}

      {cta.mode === 'locked' && schedule.dateChangeReason ? (
        <FieldCaption label={schedule.dateChangeReason} />
      ) : null}
    </OrderBoardCard>
  );
}
