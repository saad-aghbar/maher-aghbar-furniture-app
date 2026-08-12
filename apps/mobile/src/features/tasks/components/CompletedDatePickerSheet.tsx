import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import {
  MonthCalendar,
  initialCursorFromValue,
  parseYmd,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { formatDate, useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  /** YYYY-MM-DD currently applied (may be empty). */
  value: string;
  onConfirm: (ymd: string) => void;
};

/**
 * Floor-plan calendar sheet — pick a single completion day (past only).
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

  const [cursor, setCursor] = useState<CalendarCursor>(() =>
    initialCursorFromValue(value, today),
  );
  const [draft, setDraft] = useState(value.trim() || today);

  useEffect(() => {
    if (!open) return;
    setCursor(initialCursorFromValue(value, today));
    setDraft(value.trim() || today);
  }, [open, today, value]);

  const draftParsed = parseYmd(draft);
  const canApply = Boolean(draftParsed) && draft <= today;

  const board = (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
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

      <MonthCalendar
        value={draft}
        onSelect={setDraft}
        monthCursor={cursor}
        onMonthChange={setCursor}
        maxDate={today}
        disableUnavailable
        variant="default"
      />
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
