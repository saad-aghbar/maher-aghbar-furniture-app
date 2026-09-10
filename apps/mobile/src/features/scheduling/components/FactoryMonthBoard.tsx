import { View } from 'react-native';
import {
  CalendarLegend,
  MonthCalendar,
  type CalendarCursor,
  type DayMeta,
} from '@/components/calendar';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  selectedDay: string;
  cursor: CalendarCursor;
  onCursorChange: (cursor: CalendarCursor) => void;
  dayMeta: Record<string, DayMeta>;
  onSelectDay: (ymd: string) => void;
};

export function FactoryMonthBoard({
  selectedDay,
  cursor,
  onCursorChange,
  dayMeta,
  onSelectDay,
}: Props) {
  const { t } = useLocale();
  const { theme } = useTheme();

  return (
    <DealerBoard title={t('mobile.adminScheduling.monthTitle')}>
      <MonthCalendar
        variant="admin"
        embedded
        value={selectedDay}
        onSelect={onSelectDay}
        monthCursor={cursor}
        onMonthChange={onCursorChange}
        dayMeta={dayMeta}
        disableUnavailable={false}
      />
      <View style={{ marginTop: theme.spacing.sm }}>
        <CalendarLegend variant="admin" compact />
      </View>
    </DealerBoard>
  );
}
