import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
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
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { InventorySheetFooter } from '@/features/inventory/components/InventorySheetFooter';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ReportsDateRange } from '../selectReports';

type Props = {
  open: boolean;
  from: string;
  to: string;
  onClose: () => void;
  onApply: (range: ReportsDateRange) => void;
  onClear: () => void;
};

export function ReportsRangeSheet({ open, from, to, onClose, onApply, onClear }: Props) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  const today = todayYmd();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [cursor, setCursor] = useState<CalendarCursor>(() => initialCursorFromValue(from || today));
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  useEffect(() => {
    if (!open) return;
    setStart(from);
    setEnd(to);
    setCursor(initialCursorFromValue(from || today));
  }, [open, from, to, today]);

  const canApply = Boolean(start);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.reports.customRange')}
      fitContent
      maxHeight={Math.round(height * 0.88)}
    >
      <View style={{ gap: theme.spacing.md }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: Math.round(height * 0.88) - 168 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
        <DealerBoard title={t('mobile.reports.customRange')} titleWeight={titleWeight}>
          <View style={{ gap: theme.spacing.md }}>
            <AppText
              variant="caption"
              color="secondary"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.reports.customRangeHint')}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              <RangeChip
                label={t('mobile.reports.dateFrom')}
                value={start ? formatYmdLabel(start, formatDate) : '—'}
                active={Boolean(start) && !end}
              />
              <RangeChip
                label={t('mobile.reports.dateTo')}
                value={end ? formatYmdLabel(end, formatDate) : start ? formatYmdLabel(start, formatDate) : '—'}
                active={Boolean(start) && Boolean(end)}
              />
            </View>
            <MonthCalendar
              value={end || start}
              rangeStart={start}
              rangeEnd={end || start}
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
              embedded
              compact
            />
          </View>
        </DealerBoard>
        </ScrollView>
        <InventorySheetFooter
          primaryLabel={t('mobile.reports.rangeApply')}
          onPrimary={() => {
            if (!canApply) return;
            onApply({ from: start, to: end || start });
          }}
          disabled={!canApply}
          secondaryLabel={t('mobile.reports.rangeClear')}
          onSecondary={onClear}
          tertiaryLabel={t('mobile.reports.rangeCancel')}
          onTertiary={onClose}
        />
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
        overflow: 'hidden',
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: colors.brand,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      <AppText
        variant="label"
        weight={titleWeight}
        numberOfLines={1}
        dir="ltr"
        style={{ color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
      >
        {value}
      </AppText>
    </View>
  );
}
