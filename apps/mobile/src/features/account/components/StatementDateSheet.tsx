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
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  statementRangeFromDraft,
  type StatementDatePreset,
  type StatementPdfRange,
} from '../selectStatement';

type TriggerProps = {
  value: StatementDatePreset;
  customFrom?: string;
  customTo?: string;
  onPress: () => void;
};

const PRESET_LABEL: Record<StatementDatePreset, string> = {
  all: 'mobile.account.dateAll',
  '30d': 'mobile.account.date30d',
  '90d': 'mobile.account.date90d',
  custom: 'mobile.account.dateCustom',
};

/** Floor trigger for statement date presets. */
export function StatementDateTrigger({
  value,
  customFrom,
  customTo,
  onPress,
}: TriggerProps) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const active = value !== 'all';
  const label =
    value === 'custom' && customFrom
      ? `${formatYmdLabel(customFrom, formatDate)} – ${formatYmdLabel(customTo || customFrom, formatDate)}`
      : t(PRESET_LABEL[value]);

  return (
    <View
      style={{
        alignSelf: 'stretch',
        width: '100%',
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.borderStrong,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {active ? (
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

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.account.dateFilterTitle')}
        accessibilityState={{ selected: active }}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: 48,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + (active ? 4 : 0) }
            : { paddingLeft: theme.spacing.md + (active ? 4 : 0) }),
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
        <AppText
          variant="body"
          weight={titleWeight}
          numberOfLines={1}
          style={{ flex: 1, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
        >
          {label}
        </AppText>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </AnimatedPressable>
    </View>
  );
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  value: StatementDatePreset;
  customFrom?: string;
  customTo?: string;
  onChange: (next: StatementDatePreset, range?: StatementPdfRange) => void;
};

const PRESETS: StatementDatePreset[] = ['all', 'custom', '30d', '90d'];

export function StatementDateSheet({
  open,
  onClose,
  value,
  customFrom,
  customTo,
  onChange,
}: SheetProps) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const today = todayYmd();
  const dark = colorScheme === 'dark';

  const [draft, setDraft] = useState<StatementDatePreset>(value);
  const [start, setStart] = useState(customFrom ?? '');
  const [end, setEnd] = useState(customTo ?? '');
  const [cursor, setCursor] = useState<CalendarCursor>(() =>
    initialCursorFromValue(customFrom || today),
  );

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setStart(customFrom ?? '');
    setEnd(customTo ?? '');
    setCursor(initialCursorFromValue(customFrom || today));
  }, [open, value, customFrom, customTo, today]);

  const canContinue = draft !== 'custom' || Boolean(start.trim());

  const pickPreset = (next: StatementDatePreset) => {
    void haptics.selection();
    setDraft(next);
    if (next !== 'custom') {
      setStart('');
      setEnd('');
    }
  };

  const confirm = () => {
    if (!canContinue) return;
    void haptics.confirmMedium();
    if (draft === 'custom') {
      onChange(draft, statementRangeFromDraft('custom', start, end));
    } else {
      onChange(draft, {});
    }
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
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
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
        >
          {PRESETS.map((preset) => {
            const selected = preset === draft;
            return (
              <AnimatedPressable
                key={preset}
                variant="button"
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => pickPreset(preset)}
                style={{
                  flexGrow: 1,
                  flexBasis: '46%',
                  minHeight: 44,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.brand : colors.borderStrong,
                  backgroundColor: selected ? colors.brandSoft : colors.surface,
                  paddingHorizontal: theme.spacing.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {selected ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: 3,
                      backgroundColor: colors.brand,
                      opacity: 0.55,
                      ...(isRTL ? { right: 0 } : { left: 0 }),
                    }}
                  />
                ) : null}
                <AppText
                  variant="label"
                  weight={selected ? titleWeight : 'medium'}
                  style={{ color: selected ? colors.brand : colors.textPrimary }}
                >
                  {t(PRESET_LABEL[preset])}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>

        {draft === 'custom' ? (
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
                value={
                  end
                    ? formatYmdLabel(end, formatDate)
                    : start
                      ? formatYmdLabel(start, formatDate)
                      : '—'
                }
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
