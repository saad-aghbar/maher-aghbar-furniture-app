import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import {
  MonthCalendar,
  formatYmdLabel,
  initialCursorFromValue,
  nextDateRange,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import {
  statementRangeFromDraft,
  type StatementPdfRange,
} from '@/features/account/selectStatement';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Mode = 'all' | 'custom';

type Props = {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  onConfirm: (range: StatementPdfRange) => void;
};

/**
 * Statement PDF range — all activity, or a from/to calendar range.
 * Confirm closes this sheet; caller opens the PDF export sheet after `onClosed`.
 */
export function StatementRangeSheet({ open, onClose, onClosed, onConfirm }: Props) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const today = todayYmd();
  const dark = colorScheme === 'dark';

  const [mode, setMode] = useState<Mode>('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [cursor, setCursor] = useState<CalendarCursor>(() =>
    initialCursorFromValue(today),
  );

  useEffect(() => {
    if (!open) return;
    setMode('all');
    setStart('');
    setEnd('');
    setCursor(initialCursorFromValue(today));
  }, [open, today]);

  const canContinue = mode === 'all' || Boolean(start);

  const pickMode = (next: Mode) => {
    void haptics.selection();
    setMode(next);
    if (next === 'all') {
      setStart('');
      setEnd('');
    }
  };

  const confirm = () => {
    if (!canContinue) return;
    void haptics.confirmMedium();
    onConfirm(statementRangeFromDraft(mode, start, end));
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      title={t('mobile.account.dateFilterTitle')}
      fitContent
    >
      <View style={{ gap: theme.spacing.md }}>
        <AppText
          variant="caption"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.account.dateRangeHint')}
        </AppText>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          {(['all', 'custom'] as const).map((id) => {
            const selected = mode === id;
            return (
              <AnimatedPressable
                key={id}
                variant="button"
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => pickMode(id)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.brand : colors.borderStrong,
                  backgroundColor: selected ? colors.brandSoft : colors.surface,
                  paddingHorizontal: theme.spacing.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText
                  variant="label"
                  weight={selected ? titleWeight : 'medium'}
                  style={{ color: selected ? colors.brand : colors.textPrimary }}
                >
                  {id === 'all'
                    ? t('mobile.account.dateAll')
                    : t('mobile.account.dateCustom')}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>

        {mode === 'custom' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              <RangeChip
                label={t('mobile.account.dateFromLabel')}
                value={start ? formatYmdLabel(start, formatDate) : '—'}
                active={Boolean(start) && !end}
              />
              <RangeChip
                label={t('mobile.account.dateToLabel')}
                value={end ? formatYmdLabel(end, formatDate) : start ? formatYmdLabel(start, formatDate) : '—'}
                active={Boolean(start) && Boolean(end)}
              />
            </View>
            <MonthCalendar
              value={end || start}
              rangeStart={start}
              rangeEnd={end}
              onSelect={(ymd) => {
                void haptics.selection();
                const next = nextDateRange(start, end, ymd);
                setStart(next.start);
                setEnd(next.end);
              }}
              monthCursor={cursor}
              onMonthChange={setCursor}
              maxDate={today}
              disableUnavailable={false}
              showAccentRail={false}
              compact
            />
          </View>
        ) : null}

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.account.dateRangeContinue')}
          disabled={!canContinue}
          onPress={confirm}
          style={{
            minHeight: 50,
            borderRadius: theme.radius.full,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.xl,
            backgroundColor: canContinue ? colors.brand : colors.surfaceSecondary,
            opacity: canContinue ? 1 : 0.55,
            ...(canContinue && !dark
              ? {
                  shadowColor: colors.brand,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.28,
                  shadowRadius: 12,
                  elevation: 4,
                }
              : null),
          }}
        >
          <Ionicons
            name={isRTL ? 'arrow-back-circle' : 'arrow-forward-circle'}
            size={20}
            color={canContinue ? colors.onBrand : colors.textMuted}
          />
          <AppText
            variant="label"
            weight={titleWeight}
            style={{ color: canContinue ? colors.onBrand : colors.textMuted }}
          >
            {t('mobile.account.dateRangeContinue')}
          </AppText>
        </AnimatedPressable>
      </View>
    </BottomSheet>
  );
}

function RangeChip({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flex: 1,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        gap: 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText
        variant="label"
        weight={titleWeight}
        numberOfLines={1}
        style={{
          color: colors.textPrimary,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
