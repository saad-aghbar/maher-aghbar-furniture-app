import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { formatPercent, useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import type { FactoryCapacityCardModel, WeekCapacityCell } from '../selectFactoryCapacity';

type Props = {
  card: FactoryCapacityCardModel;
  cells: WeekCapacityCell[];
};

export function FactoryCapacityWeekRow({ card, cells }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const blocked = card.state === 'noEligibleWorkers' || card.state === 'unavailable';
  const accent = blocked
    ? colors.warning
    : card.state === 'full' || card.state === 'nearCapacity'
      ? colors.warning
      : colors.brand;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: blocked ? colors.warning : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: blocked ? 1 : 0.55,
        }}
      />
      <View
        style={{
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.xs,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {card.name}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 4,
          }}
        >
          {cells.map((cell) => {
            const dayLabel = t(`mobile.calendar.weekdays.${cell.weekdayKey}`);
            const a11y = cell.isWorking
              ? t('mobile.adminScheduling.capacity.weekA11yDay', {
                  name: card.name,
                  day: dayLabel,
                  percent: cell.percent ?? 0,
                })
              : t('mobile.adminScheduling.capacity.weekA11yClosed', {
                  name: card.name,
                  day: dayLabel,
                });
            const tone = !cell.isWorking
              ? colors.calendarLoadClosed
              : cell.state === 'noEligibleWorkers'
                ? colors.warningSoft
                : (cell.percent ?? 0) >= 85
                  ? colors.calendarLoadBusy
                  : (cell.percent ?? 0) >= 50
                    ? colors.calendarLoadHalf
                    : colors.calendarLoadLight;
            const latin =
              cell.isWorking && cell.state !== 'full' && cell.state !== 'noEligibleWorkers';
            const text = cell.isWorking
              ? cell.state === 'full'
                ? t('mobile.adminScheduling.capacity.state.full')
                : cell.state === 'noEligibleWorkers'
                  ? t('mobile.adminScheduling.capacity.state.noEligibleWorkers')
                  : formatPercent(locale, cell.percent ?? 0)
              : t('mobile.adminScheduling.capacity.weekClosed');
            return (
              <View
                key={cell.date}
                accessible
                accessibilityLabel={a11y}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: theme.radius.md,
                  backgroundColor: tone,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 4,
                  paddingHorizontal: 2,
                }}
              >
                <AppText variant="caption" style={{ fontSize: 10, color: colors.textPrimary }}>
                  {dayLabel}
                </AppText>
                <AppText
                  variant="caption"
                  weight="semibold"
                  dir={latin ? 'ltr' : 'auto'}
                  style={{ color: colors.textPrimary }}
                >
                  {text}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
