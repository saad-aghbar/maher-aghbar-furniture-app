import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  MATERIALS_REPORT_SECTIONS,
  toggleReportSection,
  validateMaterialsReportSections,
  validateRawMaterialsReportRange,
  type MaterialsReportSection,
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

const SECTION_ROWS: Array<Array<'all' | MaterialsReportSection>> = [
  ['all', 'fabric', 'foam'],
  ['wood', 'accessories'],
];

const PERIOD_ROWS: RawMaterialsReportPeriod[][] = [
  ['today', 'week'],
  ['month', 'custom'],
];

const SECTION_ICON: Record<'all' | MaterialsReportSection, keyof typeof Ionicons.glyphMap> = {
  all: 'albums-outline',
  fabric: 'color-palette-outline',
  foam: 'layers-outline',
  wood: 'leaf-outline',
  accessories: 'construct-outline',
};

const PERIOD_ICON: Record<RawMaterialsReportPeriod, keyof typeof Ionicons.glyphMap> = {
  today: 'today-outline',
  week: 'calendar-outline',
  month: 'calendar-number-outline',
  custom: 'options-outline',
};

/**
 * Section + period picker for the Materials PDF.
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
  const { t, isRTL, formatDate, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height: windowH } = useWindowDimensions();
  const sheetMaxH = Math.min(Math.round(windowH * 0.92), 760);
  const bodyMaxH = Math.max(280, sheetMaxH - 220);
  const today = todayYmd();
  const [period, setPeriod] = useState<RawMaterialsReportPeriod>(initialPeriod);
  const [sections, setSections] = useState<MaterialsReportSection[]>([
    ...MATERIALS_REPORT_SECTIONS,
  ]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<CalendarCursor>(() => initialCursorFromValue(today));
  const [error, setError] = useState<string | null>(null);
  const allSelected = sections.length === MATERIALS_REPORT_SECTIONS.length;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  useEffect(() => {
    if (!open) return;
    setPeriod(initialPeriod);
    setSections([...MATERIALS_REPORT_SECTIONS]);
    setFrom('');
    setTo('');
    setCursor(initialCursorFromValue(today));
    setError(null);
  }, [open, today, initialPeriod]);

  const confirm = () => {
    const sectionError = validateMaterialsReportSections(sections);
    if (sectionError) {
      setError(t(`mobile.inventory.rawReport.${sectionError}`));
      void haptics.error();
      return;
    }
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
      sections,
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

  const pickAllSections = () => {
    void haptics.selection();
    setSections([...MATERIALS_REPORT_SECTIONS]);
    setError(null);
  };

  const pickSection = (next: MaterialsReportSection) => {
    void haptics.selection();
    setSections((current) => toggleReportSection(current, next));
    setError(null);
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
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: bodyMaxH, flexShrink: 1 }}
        contentContainerStyle={{ paddingBottom: theme.spacing.sm }}
      >
        <InventorySheetBody
          fill={false}
          framed={false}
          hint={t('mobile.inventory.rawReport.sheetHint')}
          error={error}
        >
          <DeskPickerBoard
            icon="file-tray-outline"
            title={t('mobile.inventory.rawReport.sectionsLabel')}
          >
            {SECTION_ROWS.map((row) => (
              <View
                key={row.join('-')}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                {row.map((id) => {
                  const selected =
                    id === 'all' ? allSelected : !allSelected && sections.includes(id);
                  const label =
                    id === 'all'
                      ? t('mobile.inventory.rawReport.allSections')
                      : t(`mobile.inventory.groups.${id}`);
                  return (
                    <DeskCell
                      key={id}
                      testID={`materials-report-section-${id}`}
                      icon={SECTION_ICON[id]}
                      label={label}
                      selected={selected}
                      titleWeight={titleWeight}
                      onPress={() => (id === 'all' ? pickAllSections() : pickSection(id))}
                    />
                  );
                })}
              </View>
            ))}
          </DeskPickerBoard>

          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <DeskPickerHeader
              icon="calendar-outline"
              title={t('mobile.inventory.rawReport.periodLabel')}
            />
            <View
              style={{
                gap: theme.spacing.sm,
                padding: theme.spacing.sm + 2,
                ...(isRTL
                  ? { paddingRight: theme.spacing.sm + 6 }
                  : { paddingLeft: theme.spacing.sm + 6 }),
              }}
            >
              {PERIOD_ROWS.map((row) => (
                <View
                  key={row.join('-')}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: theme.spacing.sm,
                  }}
                >
                  {row.map((id) => (
                    <DeskCell
                      key={id}
                      testID={`raw-report-period-${id}`}
                      icon={PERIOD_ICON[id]}
                      label={t(`mobile.inventory.rawReport.${id}`)}
                      selected={period === id}
                      titleWeight={titleWeight}
                      uppercase
                      onPress={() => pickPeriod(id)}
                    />
                  ))}
                </View>
              ))}
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
                </View>
              ) : null}
            </View>
          </View>
        </InventorySheetBody>
      </ScrollView>
      <View style={{ flexShrink: 0 }}>
        <InventorySheetFooter
          primaryLabel={
            error ? t('mobile.inventory.rawReport.retry') : t('mobile.inventory.rawReport.generate')
          }
          onPrimary={confirm}
          onSecondary={onClose}
        />
      </View>
    </BottomSheet>
  );
}

function DeskPickerBoard({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
}) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <DeskPickerHeader icon={icon} title={title} />
      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.sm + 6 }
            : { paddingLeft: theme.spacing.sm + 6 }),
        }}
      >
        {children}
      </View>
    </View>
  );
}

function DeskPickerHeader({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <>
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
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name={icon} size={14} color={colors.brand} />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            flex: 1,
            fontSize: 11,
            color: colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
      </View>
    </>
  );
}

function DeskCell({
  icon,
  label,
  selected,
  titleWeight,
  testID,
  uppercase,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  titleWeight: 'medium' | 'semibold';
  testID: string;
  uppercase?: boolean;
  onPress: () => void;
}) {
  const { locale } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 64,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.borderStrong,
        backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      {selected ? (
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
          borderColor: selected ? colors.brand : colors.border,
        }}
      >
        <Ionicons
          name={icon}
          size={13}
          color={selected ? colors.brand : colors.textSecondary}
        />
      </View>
      <AppText
        variant="caption"
        weight={selected ? titleWeight : 'medium'}
        numberOfLines={2}
        align="center"
        style={{
          fontSize: 11,
          lineHeight: 13,
          letterSpacing: locale === 'ar' ? 0 : 0.3,
          textTransform: uppercase && locale !== 'ar' ? 'uppercase' : 'none',
          color: selected ? colors.brand : colors.textSecondary,
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
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
