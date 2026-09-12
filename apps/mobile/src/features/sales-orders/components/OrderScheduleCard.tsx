import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerScheduleDateStub } from '@/features/scheduling/components/DealerScheduleDateStub';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { OwnOrderSchedule } from '@/api/modules/scheduling';
import { selectChangeDateCta, selectOrderPromiseSummary } from '../selectSchedulePromise';
import {
  DEALER_DATE_FIELD_LABEL_KEY,
  DEALER_JOURNEY_LABEL_KEY,
  selectDealerDateFields,
  selectDeliveryTimeline,
  selectScheduleStub,
} from '@/features/scheduling/selectDealerDeliveries';

type Props = {
  schedule: OwnOrderSchedule | null | undefined;
  isLoading?: boolean;
  onChangeDate: () => void;
};

const JOURNEY_ROWS = [
  ['received', 'confirmed', 'production'],
  ['ready', 'out', 'delivered'],
] as const;

/** Dealer-facing promise summary + change-date CTA — never shows factory internals. */
export function OrderScheduleCard({ schedule, isLoading, onChangeDate }: Props) {
  const { t, formatDate, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (isLoading) {
    return (
      <DealerBoard
        title={t('mobile.orderDetail.schedule.title')}
        titleWeight={titleWeight}
      >
        <View
          style={{
            height: 16,
            borderRadius: theme.radius.sm,
            backgroundColor: colors.surfaceSecondary,
            width: '60%',
          }}
        />
      </DealerBoard>
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
  const currentKey = timeline.find((step) => step.current)?.key;
  const stub = selectScheduleStub({
    customerStatus: status,
    calendarDate: committed ?? projected ?? planned ?? requested,
    committedDeliveryDate: committed,
    projectedDeliveryDate: projected,
    plannedDeliveryDate: planned,
    requestedDeliveryDate: requested,
    actualDeliveryDate: actual,
  });

  return (
    <DealerBoard
      title={t('mobile.orderDetail.schedule.timelineTitle')}
      titleWeight={titleWeight}
      trailing={<StatusBadge status={String(status)} dot />}
      accentColor={delayed ? colors.warning : colors.brand}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'stretch',
          gap: theme.spacing.md,
        }}
      >
        <DealerScheduleDateStub ymd={stub.ymd} kind={stub.kind} />
        <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.sm, justifyContent: 'center' }}>
          {summary.compactDates && committed && !delayed ? (
            <AppText
              weight={titleWeight}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.orderDetail.schedule.compactOnTrack', {
                date: formatDate(committed),
              })}
            </AppText>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {awaiting ? (
                <AppText variant="caption" color="brand" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('mobile.orders.notConfirmed')}
                </AppText>
              ) : null}
              {dateFields.length === 0 ? (
                <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('mobile.orderDetail.schedule.noDateYet')}
                </AppText>
              ) : (
                dateFields.map((field) => (
                  <View
                    key={field.kind}
                    style={{
                      gap: 4,
                      padding: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      backgroundColor: colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{
                        textTransform: locale === 'ar' ? 'none' : 'uppercase',
                        letterSpacing: locale === 'ar' ? 0 : 0.45,
                        fontSize: 10,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {t(DEALER_DATE_FIELD_LABEL_KEY[field.kind])}
                    </AppText>
                    <AppText
                      variant="caption"
                      weight={titleWeight}
                      dir="ltr"
                      style={{
                        textAlign: isRTL ? 'right' : 'left',
                        color: field.kind === 'requested' ? colors.textMuted : colors.textPrimary,
                      }}
                    >
                      {formatDate(field.ymd)}
                    </AppText>
                  </View>
                ))
              )}
              {delayed ? (
                <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('mobile.orders.productionDelay')}
                </AppText>
              ) : null}
              {delayed && (schedule.scheduleUpdating || !projected) ? (
                <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('mobile.orders.scheduleUpdating')}
                </AppText>
              ) : !delayed && schedule.customerSafeReason ? (
                <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('mobile.orders.scheduleUpdating')}
                </AppText>
              ) : null}
            </View>
          )}
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {JOURNEY_ROWS.map((row) => (
          <View
            key={row.join('-')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            {row.map((key) => {
              const step = timeline.find((item) => item.key === key);
              const current = step?.current;
              const done = step?.done;
              return (
                <View
                  key={key}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 56,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: current ? colors.brand : colors.border,
                    backgroundColor: current
                      ? colors.brandSoft
                      : done
                        ? colors.surfaceSecondary
                        : colors.surface,
                    padding: theme.spacing.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <AppText
                    variant="caption"
                    numberOfLines={2}
                    align="center"
                    style={{
                      color: current || done ? colors.textPrimary : colors.textMuted,
                      fontSize: 10,
                    }}
                  >
                    {t(DEALER_JOURNEY_LABEL_KEY[key] ?? '')}
                  </AppText>
                  {current ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 8,
                        right: 8,
                        height: 3,
                        backgroundColor: colors.brand,
                        borderTopLeftRadius: 2,
                        borderTopRightRadius: 2,
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {cta.mode !== 'hidden' ? (
        <PrimaryButton
          label={t(cta.labelKey)}
          onPress={onChangeDate}
          disabled={cta.mode === 'locked'}
          style={{
            borderRadius: theme.radius.full,
            minHeight: theme.sizes.touch.min,
            paddingVertical: 0,
          }}
        />
      ) : null}

      {cta.mode === 'locked' && schedule.dateChangeReason ? (
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {schedule.dateChangeReason}
        </AppText>
      ) : null}
    </DealerBoard>
  );
}
