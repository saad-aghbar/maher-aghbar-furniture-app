import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { reportsDateRangeParts, type ReportsPeriod } from '../selectReports';

const PERIODS: ReportsPeriod[] = ['today', 'week', 'month'];

const PERIOD_KEY: Record<ReportsPeriod, string> = {
  today: 'mobile.reports.today',
  week: 'mobile.reports.thisWeek',
  month: 'mobile.reports.thisMonth',
};

const PERIOD_ICON: Record<ReportsPeriod, keyof typeof Ionicons.glyphMap> = {
  today: 'today-outline',
  week: 'calendar-outline',
  month: 'calendar-number-outline',
};

type Props = {
  period: ReportsPeriod;
  from: string;
  to: string;
  onChange: (next: ReportsPeriod) => void;
};

/**
 * Period buckets + live range — floor cells with a bottom bar when selected.
 */
export function ReportsPeriodChrome({ period, from, to, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const parts = reportsDateRangeParts(locale, { from, to });

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
        }}
      >
        {PERIODS.map((item) => {
          const active = item === period;
          const label = t(PERIOD_KEY[item]);
          return (
            <AnimatedPressable
              key={item}
              variant="button"
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              onPress={() => {
                if (item === period) return;
                void haptics.selection();
                onChange(item);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 48,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.borderStrong,
                backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.sm,
                overflow: 'hidden',
                alignItems: 'center',
                gap: 4,
                ...orderBoardShadow(colorScheme),
              }}
            >
              {active ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 3,
                    backgroundColor: colors.brand,
                  }}
                />
              ) : null}
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                }}
              >
                <Ionicons
                  name={PERIOD_ICON[item]}
                  size={13}
                  color={active ? colors.brand : colors.textSecondary}
                />
              </View>
              <AppText
                variant="caption"
                weight={titleWeight}
                numberOfLines={1}
                align="center"
                style={{
                  fontSize: 10,
                  lineHeight: 12,
                  letterSpacing: locale === 'ar' ? 0 : 0.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  color: active ? colors.brand : colors.textSecondary,
                }}
              >
                {label}
              </AppText>
            </AnimatedPressable>
          );
        })}
      </View>
      <AppText
        variant="caption"
        color="muted"
        dir="ltr"
        align="center"
        style={{ color: colors.textSecondary }}
      >
        {`${parts.start} ${parts.dash} ${parts.end}`}
      </AppText>
    </View>
  );
}
