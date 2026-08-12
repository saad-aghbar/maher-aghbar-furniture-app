import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { MonthCalendar, initialCursorFromValue } from './MonthCalendar';
import { parseYmd, todayYmd, type CalendarCursor } from './calendarMath';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** YYYY-MM-DD currently applied (may be empty). */
  value: string;
  onSelect: (ymd: string) => void;
  minDate?: string;
  maxDate?: string;
};

export function formatYmdLabel(
  ymd: string,
  formatDate: (value: Date | string | number) => string,
): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return '';
  return formatDate(new Date(parsed.y, parsed.m, parsed.d));
}

/**
 * Single-day calendar sheet — tap a date to confirm and close.
 */
export function DatePickerSheet({
  open,
  onClose,
  title,
  value,
  onSelect,
  minDate,
  maxDate,
}: Props) {
  const { t, isRTL, formatDate } = useLocale();
  const { theme, colors } = useTheme();
  const [cursor, setCursor] = useState<CalendarCursor>(() =>
    initialCursorFromValue(value || todayYmd()),
  );

  useEffect(() => {
    if (!open) return;
    setCursor(initialCursorFromValue(value || todayYmd()));
  }, [open, value]);

  const label = formatYmdLabel(value, formatDate);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title ?? t('mobile.calendar.pickDate')}
      fitContent
    >
      <View style={{ gap: theme.spacing.sm }}>
        <AppText
          variant="caption"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.calendar.tapADate')}
        </AppText>
        {label ? (
          <AppText
            variant="label"
            weight="medium"
            style={{
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {label}
          </AppText>
        ) : null}
        <MonthCalendar
          value={value}
          onSelect={(ymd) => {
            onSelect(ymd);
            onClose();
          }}
          monthCursor={cursor}
          onMonthChange={setCursor}
          minDate={minDate}
          maxDate={maxDate}
          disableUnavailable={false}
          showAccentRail={false}
          compact
        />
      </View>
    </BottomSheet>
  );
}
