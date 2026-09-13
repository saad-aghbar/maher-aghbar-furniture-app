import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { formatMinutesDuration, hoursMinutesToTotalMinutes, totalMinutesToHoursMinutes, bumpStageClock } from '@/features/tasks/formatDuration';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';

type Props = {
  totalMinutes: number;
  onChange: (totalMinutes: number) => void;
};

/**
 * Workshop clock for one stage on one variant — hours and minutes, not setup vs per-unit.
 */
export function StageTimeClock({ totalMinutes, onChange }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const parts = totalMinutesToHoursMinutes(totalMinutes);
  const [hoursText, setHoursText] = useState(String(parts.hours));
  const [minutesText, setMinutesText] = useState(String(parts.minutes));
  const [focus, setFocus] = useState<'hours' | 'minutes' | null>(null);

  useEffect(() => {
    const next = totalMinutesToHoursMinutes(totalMinutes);
    setHoursText(String(next.hours));
    setMinutesText(String(next.minutes));
  }, [totalMinutes]);

  function commit(nextHours: string, nextMinutes: string) {
    const h = Math.max(0, Math.min(99, Math.floor(Number(nextHours) || 0)));
    const m = Math.max(0, Math.min(59, Math.floor(Number(nextMinutes) || 0)));
    onChange(hoursMinutesToTotalMinutes(h, m));
  }

  function bump(part: 'hours' | 'minutes', delta: number) {
    void haptics.selection();
    onChange(bumpStageClock(totalMinutes, part, delta));
  }

  const hourLabel = t('mobile.production.workflow.durationHours');
  const minuteLabel = t('mobile.production.workflow.durationMinutes');
  const readout =
    totalMinutes > 0
      ? formatMinutesDuration(totalMinutes, {
          hour: t('mobile.workerHome.durationHour'),
          minute: t('mobile.workerHome.durationMinute'),
        })
      : t('mobile.production.workflow.noProductionTimeYet');

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <ClockWell
          label={hourLabel}
          value={hoursText}
          focused={focus === 'hours'}
          onFocus={() => setFocus('hours')}
          onBlur={() => {
            setFocus(null);
            commit(hoursText, minutesText);
          }}
          onChangeText={(v) => {
            const next = v.replace(/[^\d]/g, '').slice(0, 2);
            setHoursText(next);
          }}
          onMinus={() => bump('hours', -1)}
          onPlus={() => bump('hours', 1)}
        />
        <AppText
          variant="title"
          weight={titleWeight}
          dir="ltr"
          style={{ color: colors.brand, paddingBottom: 18 }}
        >
          :
        </AppText>
        <ClockWell
          label={minuteLabel}
          value={minutesText}
          focused={focus === 'minutes'}
          onFocus={() => setFocus('minutes')}
          onBlur={() => {
            setFocus(null);
            commit(hoursText, minutesText);
          }}
          onChangeText={(v) => {
            const next = v.replace(/[^\d]/g, '').slice(0, 2);
            setMinutesText(next);
          }}
          onMinus={() => bump('minutes', -1)}
          onPlus={() => bump('minutes', 1)}
        />
      </View>
      <View
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <AppText
          variant="label"
          weight={titleWeight}
          dir="ltr"
          style={{
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {readout}
        </AppText>
      </View>
    </View>
  );
}

function ClockWell({
  label,
  value,
  focused,
  onFocus,
  onBlur,
  onChangeText,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const { locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flex: 1,
        borderRadius: theme.radius.xl,
        borderWidth: focused ? 1.5 : 1,
        borderColor: focused ? colors.brand : colors.borderStrong,
        backgroundColor: focused ? colors.brandSoft : colors.surfaceSecondary,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {focused ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 0,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.brand,
          }}
        />
      ) : null}
      <AppText
        variant="caption"
        weight={titleWeight}
        align="center"
        style={{
          marginTop: theme.spacing.sm,
          color: colors.brand,
          fontSize: 11,
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
        }}
      >
        {label}
      </AppText>
      <AppTextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel={label}
        textAlign="center"
        style={{
          minHeight: 52,
          paddingVertical: 0,
          color: colors.brand,
          fontSize: 32,
          lineHeight: 38,
          fontVariant: ['tabular-nums'],
          ...resolveAppFontStyle(locale, { variant: 'title', weight: titleWeight }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={`${label} −`}
          onPress={onMinus}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="remove" size={16} color={colors.brand} />
        </AnimatedPressable>
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={`${label} +`}
          onPress={onPlus}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="add" size={16} color={colors.brand} />
        </AnimatedPressable>
      </View>
    </View>
  );
}
