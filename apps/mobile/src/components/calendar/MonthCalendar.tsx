import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import {
  WEEKDAY_LABELS,
  buildMonthCells,
  chunk,
  monthLabel,
  parseYmd,
  shiftMonth,
  toYmd,
  todayYmd,
  type CalendarCursor,
  type DayMeta,
} from './calendarMath';
import { resolveAdminLoadVisual } from './loadToneVisuals';
import type { ThemeColors } from '@/theme/types';

export type MonthCalendarVariant = 'dealer' | 'admin' | 'default';

type Props = {
  /** Selected YYYY-MM-DD (may be empty). */
  value: string;
  onSelect: (ymd: string) => void;
  monthCursor: CalendarCursor;
  onMonthChange: (cursor: CalendarCursor) => void;
  /** Per-day visual meta keyed by YYYY-MM-DD. */
  dayMeta?: Record<string, DayMeta>;
  minDate?: string;
  maxDate?: string;
  /** When true, days marked disabled/unavailable/closed cannot be selected. */
  disableUnavailable?: boolean;
  variant?: MonthCalendarVariant;
  /** Show brand accent rail (CompletedDatePicker style). */
  showAccentRail?: boolean;
  compact?: boolean;
};

const DAY_CELL = 40;
const DAY_CELL_COMPACT = 36;

/**
 * Shared month grid — brand cells, density dots, RTL-safe weekday row.
 * Used by dealer availability, admin scheduling, and completed-date picker.
 */
export function MonthCalendar({
  value,
  onSelect,
  monthCursor,
  onMonthChange,
  dayMeta = {},
  minDate,
  maxDate,
  disableUnavailable = true,
  variant = 'default',
  showAccentRail = true,
  compact = false,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const today = todayYmd();
  const cellH = compact ? DAY_CELL_COMPACT : DAY_CELL;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const cells = useMemo(
    () => buildMonthCells(monthCursor.y, monthCursor.m),
    [monthCursor.m, monthCursor.y],
  );

  const shift = (delta: number) => {
    void haptics.selection();
    onMonthChange(shiftMonth(monthCursor, delta));
  };

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor:
          variant === 'dealer' ? colors.surfaceSecondary : colors.surfaceSecondary,
        padding: compact ? theme.spacing.sm : theme.spacing.md,
        gap: compact ? theme.spacing.sm : theme.spacing.md,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {showAccentRail ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.85,
          }}
        />
      ) : null}

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingLeft: isRTL || !showAccentRail ? 0 : 4,
          paddingRight: isRTL && showAccentRail ? 4 : 0,
        }}
      >
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.calendar.prevMonth')}
          onPress={() => shift(-1)}
          style={navBtnStyle(colors, theme)}
        >
          <Ionicons
            name={isRTL ? 'chevron-forward' : 'chevron-back'}
            size={18}
            color={colors.brand}
          />
        </AnimatedPressable>

        <AppText
          variant="label"
          weight={titleWeight}
          align="center"
          numberOfLines={1}
          style={{ flex: 1, color: colors.textPrimary }}
        >
          {monthLabel(monthCursor.y, monthCursor.m)}
        </AppText>

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.calendar.nextMonth')}
          onPress={() => shift(1)}
          style={navBtnStyle(colors, theme)}
        >
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.brand}
          />
        </AnimatedPressable>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          paddingLeft: isRTL || !showAccentRail ? 0 : 4,
          paddingRight: isRTL && showAccentRail ? 4 : 0,
        }}
      >
        {WEEKDAY_LABELS.map((day) => (
          <View key={day} style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
            <AppText
              variant="caption"
              weight="medium"
              style={{
                color: colors.textMuted,
                fontSize: 11,
                letterSpacing: 0.4,
              }}
            >
              {t(`mobile.calendar.weekdays.${day.toLowerCase()}`)}
            </AppText>
          </View>
        ))}
      </View>

      <View
        style={{
          gap: 6,
          paddingLeft: isRTL || !showAccentRail ? 0 : 4,
          paddingRight: isRTL && showAccentRail ? 4 : 0,
        }}
      >
        {chunk(cells, 7).map((row, rowIdx) => (
          <View
            key={`row-${rowIdx}`}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: 6,
            }}
          >
            {row.map((day, colIdx) => {
              if (day == null) {
                return (
                  <View
                    key={`e-${rowIdx}-${colIdx}`}
                    style={{ flex: 1, height: cellH }}
                  />
                );
              }
              const ymd = toYmd(monthCursor.y, monthCursor.m, day);
              const meta = dayMeta[ymd];
              const selected = value === ymd;
              const isToday = ymd === today;
              const outOfRange =
                (minDate != null && ymd < minDate) || (maxDate != null && ymd > maxDate);
              const toneDisabled =
                disableUnavailable &&
                (meta?.disabled === true ||
                  meta?.tone === 'unavailable' ||
                  meta?.tone === 'closed');
              const disabled = outOfRange || toneDisabled;

              const cellColors = resolveCellColors({
                selected,
                isToday,
                tone: meta?.tone,
                isEarliest: meta?.isEarliest,
                colors,
                variant,
              });

              return (
                <Pressable
                  key={ymd}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={ymd}
                  onPress={() => {
                    if (disabled) return;
                    void haptics.selection();
                    onSelect(ymd);
                  }}
                  style={{
                    flex: 1,
                    height: cellH,
                    borderRadius: theme.radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: cellColors.bg,
                    borderWidth: 1,
                    borderColor: cellColors.border,
                    opacity: disabled ? 0.35 : 1,
                    gap: 2,
                  }}
                >
                  <AppText
                    variant="label"
                    weight={selected || isToday || meta?.isEarliest ? titleWeight : 'medium'}
                    style={{
                      color: cellColors.ink,
                      fontSize: compact ? 13 : 14,
                    }}
                  >
                    {String(day)}
                  </AppText>
                  {(meta?.density ?? 0) > 0 && !selected ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 2,
                        height: 4,
                        alignItems: 'center',
                      }}
                    >
                      {Array.from({ length: Math.min(meta!.density!, 3) }).map((_, i) => (
                        <View
                          key={i}
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: 1.5,
                            backgroundColor: cellColors.dot,
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function resolveCellColors(input: {
  selected: boolean;
  isToday: boolean;
  tone?: DayMeta['tone'];
  isEarliest?: boolean;
  variant: MonthCalendarVariant;
  colors: ThemeColors;
}): { bg: string; border: string; ink: string; dot: string } {
  const { selected, isToday, tone, isEarliest, colors, variant } = input;
  if (selected) {
    return {
      bg: colors.brand,
      border: colors.brand,
      ink: colors.onBrand,
      dot: colors.onBrand,
    };
  }

  // Dealer + admin share Empty/Light/Half/Busy/Closed (same legend).
  // Dealer earliest stays on the load ladder (light), not a separate green.
  const isLoadTone =
    tone === 'empty' ||
    tone === 'light' ||
    tone === 'half' ||
    tone === 'busy' ||
    tone === 'closed' ||
    tone === 'unavailable';

  if (isLoadTone && (variant === 'admin' || variant === 'dealer' || tone !== 'empty')) {
    const loadTone = tone === 'unavailable' ? 'busy' : tone;
    const load = resolveAdminLoadVisual(loadTone, colors);
    return {
      bg: load.bg,
      border: isToday || isEarliest ? colors.brand : load.border,
      ink: load.ink,
      dot: load.dot,
    };
  }

  if (isEarliest || tone === 'earliest' || tone === 'available') {
    // Legacy dealer tones → light bucket on the shared palette.
    const load = resolveAdminLoadVisual('light', colors);
    return {
      bg: load.bg,
      border: colors.brand,
      ink: load.ink,
      dot: load.dot,
    };
  }

  if (isToday) {
    return {
      bg: colors.brandSoft,
      border: colors.brand,
      ink: colors.textPrimary,
      dot: colors.brand,
    };
  }
  return {
    bg: colors.surface,
    border: colors.border,
    ink: colors.textPrimary,
    dot: colors.brand,
  };
}

function navBtnStyle(
  colors: { surface: string; border: string },
  theme: { radius: { full: number } },
) {
  return {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  };
}

export function initialCursorFromValue(value: string, fallbackToday = todayYmd()): CalendarCursor {
  const parsed = parseYmd(value) ?? parseYmd(fallbackToday)!;
  return { y: parsed.y, m: parsed.m };
}
