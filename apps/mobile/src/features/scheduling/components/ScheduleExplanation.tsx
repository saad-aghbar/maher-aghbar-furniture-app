import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  selectScheduleDates,
  type ScheduleDateSource,
} from '../selectScheduleDates';

type Props = {
  source: ScheduleDateSource;
  variant: 'compact' | 'detail';
  stageName?: string;
  canReview?: boolean;
  onReview?: () => void;
};

export function ScheduleExplanation({ source, variant, stageName, canReview, onReview }: Props) {
  const { t, tPlural, isRTL, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  const dates = selectScheduleDates(source, stageName);
  const detail = variant === 'detail';

  const line = (label: string, value: string, muted = true, latin = false) => (
    <View
      key={`${label}-${value}`}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: 8,
        width: '100%',
      }}
    >
      <AppText variant="caption" color={muted ? 'muted' : 'secondary'} style={{ flexShrink: 1 }}>
        {label}
      </AppText>
      <AppText variant="caption" weight="semibold" dir={latin ? 'ltr' : 'auto'}>
        {value}
      </AppText>
    </View>
  );

  const reviewButton =
    canReview && onReview ? (
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.adminScheduling.dates.reviewSchedule')}
        onPress={() => {
          void haptics.selection();
          onReview();
        }}
        style={{
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          minHeight: 32,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSoft,
          borderWidth: 1,
          borderColor: colors.brand,
        }}
      >
        <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
          {t('mobile.adminScheduling.dates.reviewSchedule')}
        </AppText>
      </AnimatedPressable>
    ) : null;

  if (dates.plan === 'blocked' && dates.blocked) {
    const material = dates.blocked.reasonKey === 'mobile.adminScheduling.reasons.materialNotReady';
    return (
      <View style={{ gap: theme.spacing.xs, width: '100%', alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ color: colors.warning, textAlign: isRTL ? 'right' : 'left', width: '100%' }}
        >
          {t(dates.blocked.titleKey)}
        </AppText>
        <AppText
          variant="caption"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left', width: '100%' }}
        >
          {dates.blocked.name
            ? t(dates.blocked.bodyKey, { name: dates.blocked.name })
            : t(dates.blocked.bodyKey)}
        </AppText>
        {material ? (
          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left', width: '100%' }}>
            {dates.materialReadyAtIso
              ? t('mobile.adminScheduling.blocked.expectedReady', {
                  date: formatDate(dates.materialReadyAtIso),
                })
              : t('mobile.adminScheduling.blocked.expectedReadyUnknown')}
          </AppText>
        ) : null}
        {reviewButton}
      </View>
    );
  }

  if (dates.plan === 'infeasible') {
    return (
      <View
        style={{
          width: '100%',
          gap: theme.spacing.xs,
          padding: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.warning,
          backgroundColor: colors.warningSoft,
          alignItems: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{ color: colors.warning, textAlign: isRTL ? 'right' : 'left', width: '100%' }}
        >
          {t('mobile.adminScheduling.dates.infeasibleTitle')}
        </AppText>
        {dates.requestedIso
          ? line(
              t('mobile.adminScheduling.dates.dealerRequested'),
              formatDate(dates.requestedIso),
              false,
            )
          : null}
        {dates.earliestIso || dates.suggestedIso
          ? line(
              t('mobile.adminScheduling.dates.earliestFeasible'),
              formatDate(dates.earliestIso ?? dates.suggestedIso!),
              false,
            )
          : null}
        {dates.daysLater != null && dates.daysLater > 0 ? (
          <AppText variant="caption" color="secondary">
            {tPlural('mobile.adminScheduling.dates.daysLater', dates.daysLater)}
          </AppText>
        ) : null}
        {reviewButton}
      </View>
    );
  }

  const rows: Array<{ label: string; value: string }> = [];

  if (dates.plan === 'identical') {
    const delivery = dates.committedIso ?? dates.suggestedIso ?? dates.requestedIso;
    if (delivery) {
      rows.push({
        label: t('mobile.adminScheduling.dates.delivery'),
        value: formatDate(delivery),
      });
    }
  } else if (dates.plan === 'earliest') {
    rows.push({
      label: t('mobile.adminScheduling.dates.schedulingMode'),
      value: t('mobile.adminScheduling.dates.earliestAvailable'),
    });
    if (dates.suggestedIso) {
      rows.push({
        label: t('mobile.adminScheduling.dates.suggested'),
        value: formatDate(dates.suggestedIso),
      });
    }
    if (dates.committedIso) {
      rows.push({
        label: t('mobile.adminScheduling.dates.committed'),
        value: formatDate(dates.committedIso),
      });
    }
  } else {
    if (dates.requestedIso) {
      rows.push({
        label: t('mobile.adminScheduling.dates.requested'),
        value: formatDate(dates.requestedIso),
      });
    }
    if (dates.suggestedIso && !dates.identicalRequestedSuggested) {
      rows.push({
        label: t('mobile.adminScheduling.dates.suggested'),
        value: formatDate(dates.suggestedIso),
      });
    }
    if (dates.committedIso) {
      rows.push({
        label: t('mobile.adminScheduling.dates.committed'),
        value: formatDate(dates.committedIso),
      });
    }
  }

  if (dates.plannedStartIso) {
    const start = formatDate(dates.plannedStartIso);
    const end = dates.plannedEndIso ? formatDate(dates.plannedEndIso) : null;
    rows.push({
      label: t('mobile.adminScheduling.dates.plannedProduction'),
      value: end && end !== start ? `${start} – ${end}` : start,
    });
  }

  if (detail && dates.productionDeadlineIso) {
    rows.push({
      label: t('mobile.adminScheduling.dates.productionDeadline'),
      value: formatDate(dates.productionDeadlineIso),
    });
  }
  if (detail && dates.deliveryBufferWorkingDays != null && dates.deliveryBufferWorkingDays > 0) {
    rows.push({
      label: tPlural(
        'mobile.adminScheduling.dates.deliveryPreparation',
        dates.deliveryBufferWorkingDays,
      ),
      value: '',
    });
  }
  if (dates.materialReadyAtIso) {
    rows.push({
      label: t('mobile.adminScheduling.blocked.expectedReady', {
        date: formatDate(dates.materialReadyAtIso),
      }),
      value: '',
    });
  }

  return (
    <View style={{ gap: theme.spacing.xs, width: '100%', alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
      {dates.onTrack ? (
        <AppText variant="caption" style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.adminScheduling.dates.onTrack')}
        </AppText>
      ) : dates.feasible === true && dates.plan === 'identical' ? (
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.adminScheduling.dates.requestedFeasible')}
        </AppText>
      ) : dates.notApproved ? (
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.adminScheduling.dates.notApproved')}
        </AppText>
      ) : null}
      {rows.map((row) =>
        row.value
          ? line(row.label, row.value)
          : (
              <AppText
                key={row.label}
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left', width: '100%' }}
              >
                {row.label}
              </AppText>
            ),
      )}
    </View>
  );
}
