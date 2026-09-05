import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import {
  MonthCalendar,
  formatYmdLabel,
  initialCursorFromValue,
  nextDateRange,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  validateRawMaterialsReportRange,
  type RawMaterialsReportPeriod,
  type RawMaterialsReportRequest,
} from '../rawMaterialsReport';
import { InventorySheetBody } from './InventorySheetBody';
import { InventorySheetFooter } from './InventorySheetFooter';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Fires after this Modal unmounts — open PdfDownloadSheet only from here. */
  onClosed?: () => void;
  onConfirm: (request: RawMaterialsReportRequest) => void;
  initialPeriod?: RawMaterialsReportPeriod;
};

const PERIODS: RawMaterialsReportPeriod[] = ['today', 'week', 'month', 'custom'];

/**
 * Period picker for the Raw Materials PDF.
 * Confirm closes this sheet; the host opens language/theme after `onClosed`
 * so iOS is not asked to present a second Modal on top of this one.
 */
export function RawMaterialsReportSheet({
  open,
  onClose,
  onClosed,
  onConfirm,
  initialPeriod = 'month',
}: Props) {
  const { t, locale, isRTL, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  const { height: windowH } = useWindowDimensions();
  const sheetMaxH = Math.min(Math.round(windowH * 0.92), 760);
  const calendarMaxH = Math.max(320, sheetMaxH - 240);
  const today = todayYmd();
  const [period, setPeriod] = useState<RawMaterialsReportPeriod>(initialPeriod);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<CalendarCursor>(() => initialCursorFromValue(today));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPeriod(initialPeriod);
    setFrom('');
    setTo('');
    setCursor(initialCursorFromValue(today));
    setError(null);
  }, [open, today, initialPeriod]);

  const confirm = () => {
    const rangeError = validateRawMaterialsReportRange(period, from, to);
    if (rangeError) {
      setError(t(`mobile.inventory.rawReport.${rangeError}`));
      void haptics.error();
      return;
    }
    setError(null);
    onConfirm({
      period,
      from: period === 'custom' ? from : undefined,
      to: period === 'custom' ? to : undefined,
    });
  };

  const pickPeriod = (next: RawMaterialsReportPeriod) => {
    void haptics.selection();
    setPeriod(next);
    setError(null);
    if (next !== 'custom') {
      setFrom('');
      setTo('');
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      title={t('mobile.inventory.rawReport.sheetTitle')}
      fitContent
      maxHeight={sheetMaxH}
    >
      <InventorySheetBody
        fill={false}
        hint={t('mobile.inventory.rawReport.sheetHint')}
        error={error}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
        >
          {PERIODS.map((id) => {
            const selected = period === id;
            return (
              <AnimatedPressable
                key={id}
                variant="button"
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t(`mobile.inventory.rawReport.${id}`)}
                testID={`raw-report-period-${id}`}
                onPress={() => pickPeriod(id)}
                style={{
                  minHeight: 40,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: selected ? colors.brand : colors.borderStrong,
                  backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  overflow: 'hidden',
                  paddingStart: selected ? theme.spacing.md + 4 : theme.spacing.md,
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
                      ...(isRTL ? { right: 0 } : { left: 0 }),
                    }}
                  />
                ) : null}
                <AppText
                  variant="label"
                  weight={selected ? (locale === 'ar' ? 'medium' : 'semibold') : 'medium'}
                  style={{ color: selected ? colors.brand : colors.textPrimary }}
                >
                  {t(`mobile.inventory.rawReport.${id}`)}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>

        {period === 'custom' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              <RangeChip
                label={t('mobile.inventory.rawReport.from')}
                value={from ? formatYmdLabel(from, formatDate) : '—'}
                active={Boolean(from) && !to}
              />
              <RangeChip
                label={t('mobile.inventory.rawReport.to')}
                value={
                  to
                    ? formatYmdLabel(to, formatDate)
                    : from
                      ? formatYmdLabel(from, formatDate)
                      : '—'
                }
                active={Boolean(from) && Boolean(to)}
              />
            </View>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: calendarMaxH, minHeight: 280 }}
            >
              <MonthCalendar
                value={to || from}
                rangeStart={from}
                rangeEnd={to}
                onSelect={(ymd) => {
                  void haptics.selection();
                  const next = nextDateRange(from, to, ymd);
                  setFrom(next.start);
                  setTo(next.end);
                  setError(null);
                }}
                monthCursor={cursor}
                onMonthChange={setCursor}
                maxDate={today}
                disableUnavailable={false}
                showAccentRail={false}
                compact
              />
            </ScrollView>
          </View>
        ) : null}
      </InventorySheetBody>
      <InventorySheetFooter
        primaryLabel={
          error ? t('mobile.inventory.rawReport.retry') : t('mobile.inventory.rawReport.generate')
        }
        onPrimary={confirm}
        onSecondary={onClose}
      />
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
