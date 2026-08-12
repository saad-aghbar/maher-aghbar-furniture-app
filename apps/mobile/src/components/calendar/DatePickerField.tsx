import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { DatePickerSheet, formatYmdLabel } from './DatePickerSheet';
import { MonthCalendar, initialCursorFromValue } from './MonthCalendar';
import { todayYmd, type CalendarCursor } from './calendarMath';

type FieldProps = {
  label: string;
  value: string;
  onChange: (ymd: string) => void;
  error?: string;
};

/**
 * Labeled row that opens DatePickerSheet. Tap a day to set the value.
 */
export function DatePickerField({ label, value, onChange, error }: FieldProps) {
  const { t, isRTL, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const [open, setOpen] = useState(false);
  const display = formatYmdLabel(value, formatDate);

  return (
    <View style={{ gap: theme.spacing.xs, width: '100%' }}>
      <AppText variant="label" color="secondary">
        {label}
      </AppText>
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          void haptics.selection();
          setOpen(true);
        }}
        style={{
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.borderStrong,
          backgroundColor: colors.surface,
          paddingHorizontal: theme.spacing.lg,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.brand} />
        <AppText
          variant="body"
          style={{
            flex: 1,
            color: display ? colors.textPrimary : colors.textMuted,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {display || t('mobile.calendar.tapADate')}
        </AppText>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={colors.textMuted}
        />
      </AnimatedPressable>
      {error ? (
        <AppText variant="caption" color="error">
          {error}
        </AppText>
      ) : null}
      <DatePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        value={value}
        onSelect={onChange}
      />
    </View>
  );
}

type InlineProps = {
  value: string;
  onSelect: (ymd: string) => void;
  compact?: boolean;
  /** When this changes (e.g. parent sheet opens), re-anchor the month. */
  resetKey?: string | number | boolean;
};

/**
 * Compact month grid for a sheet that is already open (no nested modal).
 */
export function InlineDateCalendar({
  value,
  onSelect,
  compact = true,
  resetKey,
}: InlineProps) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const [cursor, setCursor] = useState<CalendarCursor>(() =>
    initialCursorFromValue(value || todayYmd()),
  );

  useEffect(() => {
    setCursor(initialCursorFromValue(value || todayYmd()));
  }, [resetKey]);

  useEffect(() => {
    if (!value) return;
    setCursor((prev) => {
      const next = initialCursorFromValue(value);
      if (prev.y === next.y && prev.m === next.m) return prev;
      return next;
    });
  }, [value]);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText
        variant="caption"
        color="secondary"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {t('mobile.calendar.tapADate')}
      </AppText>
      <MonthCalendar
        value={value}
        onSelect={onSelect}
        monthCursor={cursor}
        onMonthChange={setCursor}
        disableUnavailable={false}
        showAccentRail={false}
        compact={compact}
      />
    </View>
  );
}
