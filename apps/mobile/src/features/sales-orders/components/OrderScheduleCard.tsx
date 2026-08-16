import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { OwnOrderSchedule } from '@/api/modules/scheduling';
import { selectChangeDateCta, selectOrderPromiseSummary } from '../selectSchedulePromise';
import { selectDeliveryTimeline } from '@/features/scheduling/selectDealerDeliveries';
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
  const actual = summary.actualDeliveryDate;
  const awaiting = status === 'AWAITING_CONFIRMATION' || summary.showEstimateOnly;
  const delayed = status === 'MAY_BE_DELAYED' || status === 'DELAYED';
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

      {summary.compactDates && committed ? (
        <FieldValue
          value={t('mobile.orderDetail.schedule.compactOnTrack', {
            date: formatDate(committed),
          })}
        />
      ) : awaiting ? (
        <View style={{ gap: theme.spacing.xs }}>
          <FieldCaption label={t('mobile.orderDetail.schedule.newDateProposed')} />
          {requested ? (
            <View style={{ gap: 2 }}>
              <FieldCaption label={t('mobile.orderDetail.schedule.requestedDate')} />
              <FieldValue value={formatDate(requested)} muted />
            </View>
          ) : null}
          {suggested ? (
            <View style={{ gap: 2 }}>
              <FieldCaption label={t('mobile.orders.earliestAvailable')} />
              <FieldValue value={formatDate(suggested)} />
            </View>
          ) : (
            <FieldCaption label={t('mobile.orderDetail.schedule.noDateYet')} />
          )}
        </View>
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          {committed ? (
            <View style={{ gap: 2 }}>
              <FieldCaption label={t('mobile.orderDetail.schedule.committedDate')} />
              <FieldValue value={formatDate(committed)} />
            </View>
          ) : null}
          {projected && projected.slice(0, 10) !== committed?.slice(0, 10) ? (
            <View style={{ gap: 2 }}>
              <FieldCaption label={t('mobile.orderDetail.schedule.projectedDate')} />
              <FieldValue value={formatDate(projected)} />
            </View>
          ) : null}
          {actual ? (
            <View style={{ gap: 2 }}>
              <FieldCaption label={t('mobile.orderDetail.schedule.actualDate')} />
              <FieldValue value={formatDate(actual)} />
            </View>
          ) : null}
          {requested && requested.slice(0, 10) !== committed?.slice(0, 10) ? (
            <View style={{ gap: 2 }}>
              <FieldCaption label={t('mobile.orderDetail.schedule.requestedDate')} />
              <FieldValue value={formatDate(requested)} muted />
            </View>
          ) : null}
          {delayed ? (
            <FieldCaption label={t('mobile.orders.productionDelay')} />
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
