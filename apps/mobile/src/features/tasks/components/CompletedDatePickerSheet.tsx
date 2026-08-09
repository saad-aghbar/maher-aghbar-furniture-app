import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { formatDate, useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

type Props = {
  open: boolean;
  onClose: () => void;
  /** YYYY-MM-DD currently applied (may be empty). */
  value: string;
  onConfirm: (ymd: string) => void;
};

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
const DAY_CELL = 40;

function todayYmd(): string {
  const d = new Date();
  return toYmd(d.getFullYear(), d.getMonth(), d.getDate());
}

function toYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return { y, m: mo - 1, d };
}

function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(new Date(year, monthIndex, 1));
}

function buildMonthCells(year: number, monthIndex: number): Array<number | null> {
  const first = new Date(year, monthIndex, 1);
  /** Monday = 0 … Sunday = 6 */
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Floor-plan calendar sheet — pick a single completion day.
 */
export function CompletedDatePickerSheet({
  open,
  onClose,
  value,
  onConfirm,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const dark = colorScheme === 'dark';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const today = todayYmd();
  const sheetHeight = Math.min(Math.round(height * 0.78), 620);

  const initial = parseYmd(value) ?? parseYmd(today)!;
  const [cursor, setCursor] = useState({ y: initial.y, m: initial.m });
  const [draft, setDraft] = useState(value.trim() || today);

  useEffect(() => {
    if (!open) return;
    const parsed = parseYmd(value) ?? parseYmd(today)!;
    setCursor({ y: parsed.y, m: parsed.m });
    setDraft(value.trim() || today);
  }, [open, today, value]);

  const cells = useMemo(
    () => buildMonthCells(cursor.y, cursor.m),
    [cursor.m, cursor.y],
  );

  const draftParsed = parseYmd(draft);
  const canApply = Boolean(draftParsed) && draft <= today;

  const shiftMonth = (delta: number) => {
    void haptics.selection();
    setCursor((prev) => {
      const next = new Date(prev.y, prev.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  };

  const board = (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.md,
        gap: theme.spacing.md,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
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

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingLeft: isRTL ? 0 : 4,
          paddingRight: isRTL ? 4 : 0,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <AppText
            variant="caption"
            numberOfLines={1}
            style={{
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              fontSize: 11,
              lineHeight: 14,
              color: colors.brand,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.tasks.completedDateSheetEyebrow')}
          </AppText>
          <AppText
            variant="body"
            weight={titleWeight}
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {draftParsed
              ? formatDate(locale, new Date(draftParsed.y, draftParsed.m, draftParsed.d))
              : t('mobile.tasks.completedDateCustom')}
          </AppText>
        </View>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingLeft: isRTL ? 0 : 4,
          paddingRight: isRTL ? 4 : 0,
        }}
      >
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.tasks.completedDatePrevMonth')}
          onPress={() => shiftMonth(-1)}
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
          {monthLabel(cursor.y, cursor.m)}
        </AppText>

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.tasks.completedDateNextMonth')}
          onPress={() => shiftMonth(1)}
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
          paddingLeft: isRTL ? 0 : 4,
          paddingRight: isRTL ? 4 : 0,
        }}
      >
        {WEEKDAYS.map((day) => (
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
              {day}
            </AppText>
          </View>
        ))}
      </View>

      <View
        style={{
          gap: 6,
          paddingLeft: isRTL ? 0 : 4,
          paddingRight: isRTL ? 4 : 0,
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
                    style={{ flex: 1, height: DAY_CELL }}
                  />
                );
              }
              const ymd = toYmd(cursor.y, cursor.m, day);
              const selected = draft === ymd;
              const isToday = ymd === today;
              const disabled = ymd > today;

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
                    setDraft(ymd);
                  }}
                  style={{
                    flex: 1,
                    height: DAY_CELL,
                    borderRadius: theme.radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected
                      ? colors.brand
                      : isToday
                        ? colors.brandSoft
                        : colors.surface,
                    borderWidth: 1,
                    borderColor: selected
                      ? colors.brand
                      : isToday
                        ? colors.brand
                        : colors.border,
                    opacity: disabled ? 0.35 : 1,
                  }}
                >
                  <AppText
                    variant="label"
                    weight={selected || isToday ? titleWeight : 'medium'}
                    style={{
                      color: selected
                        ? colors.onBrand
                        : disabled
                          ? colors.textMuted
                          : colors.textPrimary,
                      fontSize: 14,
                    }}
                  >
                    {String(day)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.tasks.completedDateSheetTitle')}
      sheetHeight={sheetHeight}
    >
      <View style={{ flex: 1, minHeight: 0, gap: theme.spacing.md }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
          bounces
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <AppText
            variant="body"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.tasks.completedDateSheetBody')}
          </AppText>

          {reduce ? (
            board
          ) : (
            <Animated.View entering={FadeInDown.delay(40).duration(160)}>
              {board}
            </Animated.View>
          )}
        </ScrollView>

        <View
          style={{
            paddingTop: theme.spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={() => {
              void haptics.selection();
              onClose();
            }}
            style={{
              flex: 1,
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.md,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText variant="label" weight="medium" style={{ color: colors.textSecondary }}>
              {t('common.cancel')}
            </AppText>
          </AnimatedPressable>

          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.tasks.completedDateApply')}
            accessibilityState={{ disabled: !canApply }}
            disabled={!canApply}
            onPress={() => {
              if (!canApply) return;
              void haptics.confirmLight();
              onConfirm(draft);
            }}
            style={{
              flex: 1.35,
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              backgroundColor: canApply ? colors.brand : colors.disabledFill,
              ...(canApply
                ? dark
                  ? {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.35,
                      shadowRadius: 10,
                    }
                  : {
                      shadowColor: colors.brand,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.28,
                      shadowRadius: 12,
                    }
                : null),
            }}
          >
            <AppText
              variant="label"
              weight={titleWeight}
              style={{ color: canApply ? colors.onBrand : colors.disabled }}
            >
              {t('mobile.tasks.completedDateApply')}
            </AppText>
            <Ionicons
              name="checkmark"
              size={18}
              color={canApply ? colors.onBrand : colors.disabled}
            />
          </AnimatedPressable>
        </View>
      </View>
    </BottomSheet>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
