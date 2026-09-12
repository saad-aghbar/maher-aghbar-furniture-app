import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import {
  MonthCalendar,
  type CalendarCursor,
  type DayMeta,
} from '@/components/calendar';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { DealerBoardPill } from './DealerDeliveryOrdersBoard';

type Props = {
  selectedDay: string;
  cursor: CalendarCursor;
  onCursorChange: (cursor: CalendarCursor) => void;
  dayMeta: Record<string, DayMeta>;
  onSelectDay: (ymd: string) => void;
  showToday?: boolean;
  onJumpToday?: () => void;
};

const MARKERS = [
  ['confirmed', 'mobile.orders.legendConfirmed', 'success'],
  ['expected', 'mobile.orders.legendExpected', 'brand'],
  ['delayed', 'mobile.orders.legendMayBeDelayed', 'warning'],
  ['delivered', 'mobile.orders.legendDelivered', 'success'],
] as const;

/** Dealer month desk — delivery markers, not factory load %. */
export function DealerMonthBoard({
  selectedDay,
  cursor,
  onCursorChange,
  dayMeta,
  onSelectDay,
  showToday,
  onJumpToday,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <DealerBoard
      title={t('mobile.dealerAccount.calendarMonthTitle')}
      titleWeight={titleWeight}
      trailing={
        showToday && onJumpToday ? (
          <DealerBoardPill
            label={t('mobile.dealerAccount.calendarToday')}
            onPress={onJumpToday}
          />
        ) : null
      }
    >
      <MonthCalendar
        variant="dealer"
        embedded
        value={selectedDay}
        onSelect={onSelectDay}
        monthCursor={cursor}
        onMonthChange={onCursorChange}
        dayMeta={dayMeta}
        disableUnavailable={false}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {MARKERS.map(([key, labelKey, tone]) => {
          const color =
            tone === 'warning'
              ? colors.warning
              : tone === 'success'
                ? colors.success
                : colors.brand;
          return (
            <View
              key={key}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: theme.spacing.sm + 2,
                paddingVertical: 6,
                borderRadius: theme.radius.lg,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
              <AppText variant="caption" color="secondary">
                {t(labelKey)}
              </AppText>
            </View>
          );
        })}
      </View>
    </DealerBoard>
  );
}
