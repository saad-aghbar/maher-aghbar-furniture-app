import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { OwnOrderSchedule } from '@/api/modules/scheduling';
import { selectChangeDateCta, selectOrderPromiseSummary } from '../selectSchedulePromise';
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

/** Dealer-facing promise summary + change-date CTA — never shows factory internals. */
export function OrderScheduleCard({ schedule, isLoading, onChangeDate }: Props) {
  const { t, formatDate } = useLocale();
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

  const dateToShow = summary.committedDeliveryDate ?? summary.suggestedDeliveryDate;

  return (
    <OrderBoardCard accent={colors.brand}>
      <OrderSectionHeader
        icon="calendar-outline"
        label={t('mobile.orderDetail.schedule.title')}
        trailing={<StatusBadge status={summary.promiseState} dot />}
      />

      {dateToShow ? (
        <View style={{ gap: 2 }}>
          <FieldCaption
            label={
              summary.showEstimateOnly
                ? t('mobile.orderDetail.schedule.estimatedDate')
                : t('mobile.orderDetail.schedule.committedDate')
            }
          />
          <FieldValue value={formatDate(dateToShow)} />
        </View>
      ) : (
        <FieldCaption label={t('mobile.orderDetail.schedule.noDateYet')} />
      )}

      {summary.requestedDeliveryDate ? (
        <View style={{ gap: 2 }}>
          <FieldCaption label={t('mobile.orderDetail.schedule.requestedDate')} />
          <FieldValue value={formatDate(summary.requestedDeliveryDate)} muted />
        </View>
      ) : null}

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
