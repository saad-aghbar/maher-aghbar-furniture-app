import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { DatePickerSheet, formatYmdLabel } from '@/components/calendar';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionDateMode, ProductionDayFocus, ProductionDaySummary } from '../api';
import { productionInsetStyle, productionSectionLabelStyle } from '../productionFloorStyle';
import { OriginFocusBar, type OriginFocus } from './OriginFocusBar';

type ProductionDateScope = 'day' | 'all';

type Props = {
  dateScope: ProductionDateScope;
  onDate: string;
  dateMode: ProductionDateMode;
  dayFocus: ProductionDayFocus | null;
  factoryTodayYmd: string;
  summary: ProductionDaySummary | null;
  origin: OriginFocus;
  onChangeOrigin: (next: OriginFocus) => void;
  onChangeScope: (scope: ProductionDateScope) => void;
  onChangeDate: (ymd: string) => void;
  onChangeMode: (mode: ProductionDateMode) => void;
  onChangeDayFocus: (focus: ProductionDayFocus | null) => void;
  calendarOpen: boolean;
  onCalendarOpenChange: (open: boolean) => void;
};

const MODE_ICON: Record<ProductionDateMode, keyof typeof Ionicons.glyphMap> = {
  planned: 'calendar-outline',
  actual: 'pulse-outline',
};

const SCOPE_ICON: Record<ProductionDateScope, keyof typeof Ionicons.glyphMap> = {
  day: 'calendar-outline',
  all: 'infinite-outline',
};

function looksLikeCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{2,}$/.test(value.trim());
}

function humanizeCode(code: string): string {
  return code
    .trim()
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function departmentChipLabel(
  dept: { code: string; nameEn: string; nameAr?: string | null; nameHe?: string | null },
  locale: string,
): string {
  const named = localizedName(locale, dept, dept.nameEn || '');
  if (named && !looksLikeCode(named)) return named;
  if (dept.code && dept.code !== 'OTHER') return humanizeCode(dept.code);
  return named || dept.code;
}

/**
 * Factory day lens — parchment desk calendar for Planned vs Actual.
 * Origin pills live here so the hub is one board.
 */
export function ProductionDayLensBoard({
  dateScope,
  onDate,
  dateMode,
  dayFocus,
  factoryTodayYmd,
  summary,
  origin,
  onChangeOrigin,
  onChangeScope,
  onChangeDate,
  onChangeMode,
  onChangeDayFocus,
  calendarOpen,
  onCalendarOpenChange,
}: Props) {
  const { t, locale, isRTL, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const isAllTime = dateScope === 'all';
  const isToday = onDate === factoryTodayYmd;
  const isFuture = summary?.isFuture ?? onDate > factoryTodayYmd;
  const showTodayPulse = !isAllTime && isToday;

  const selectedLabel = formatYmdLabel(onDate, formatDate);
  const weekdayLong = (() => {
    const d = new Date(`${onDate}T12:00:00Z`);
    return d.toLocaleDateString(locale, { weekday: 'long' });
  })();

  const plannedOrders = summary?.planned.orders ?? 0;
  const plannedTasks = summary?.planned.tasks ?? 0;
  const actualOrders = summary?.actual.orders ?? 0;
  const actualEvents = summary?.actual.taskEvents ?? 0;
  const lateMissedOrders = summary?.lateMissed ?? 0;
  const lateMissedTasks = summary?.lateMissedTasks ?? 0;
  const atRiskOrders = summary?.atRisk ?? 0;

  const headerModeLabel = isAllTime
    ? t('mobile.production.dayLens.allTime')
    : dayFocus === 'late_missed'
      ? t('mobile.production.dayLens.lateMissed')
      : dayFocus === 'at_risk'
        ? t('mobile.production.dayLens.atRisk')
        : dateMode === 'planned'
          ? t('mobile.production.dayLens.planned')
          : t('mobile.production.dayLens.actual');

  const headerAccent =
    isAllTime
      ? colors.textSecondary
      : dayFocus
        ? colors.warning
        : dateMode === 'planned'
          ? colors.brand
          : colors.success;

  const headerSoft =
    isAllTime
      ? colors.surfaceSecondary
      : dayFocus
        ? colors.warningSoft
        : dateMode === 'planned'
          ? colors.brandSoft
          : colors.successSoft;

  const railColor = isAllTime
    ? colors.surfaceSecondary
    : dayFocus
      ? colors.warning
      : dateMode === 'planned'
        ? colors.brand
        : colors.success;

  const applyPlanned = () => {
    void haptics.selection();
    onChangeMode('planned');
    onChangeDayFocus(null);
  };
  const applyActual = () => {
    void haptics.selection();
    onChangeMode('actual');
    onChangeDayFocus(null);
  };
  const applyLate = () => {
    void haptics.selection();
    onChangeMode('planned');
    onChangeDayFocus('late_missed');
  };
  const applyAtRisk = () => {
    void haptics.selection();
    onChangeMode('planned');
    onChangeDayFocus('at_risk');
  };

  const listHint = isAllTime
    ? t('mobile.production.dayLens.listHintAllTime')
    : dayFocus === 'late_missed'
      ? t('mobile.production.dayLens.listHintLateMissed', { date: selectedLabel })
      : dayFocus === 'at_risk'
        ? t('mobile.production.dayLens.listHintAtRisk', { date: selectedLabel })
        : dateMode === 'planned'
          ? t('mobile.production.dayLens.listHintPlanned', { date: selectedLabel })
          : t('mobile.production.dayLens.listHintActual', { date: selectedLabel });

  return (
    <>
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
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: railColor,
            opacity: isAllTime ? 0.45 : 0.65,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
            backgroundColor: colors.surfaceSecondary,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="caption"
              weight={titleWeight}
              style={productionSectionLabelStyle(locale, colors.brand)}
            >
              {t('mobile.production.dayLens.eyebrow')}
            </AppText>
            <AppText variant="label" weight={titleWeight} numberOfLines={1}>
              {t('mobile.production.dayLens.title')}
            </AppText>
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 6,
              borderRadius: theme.radius.full,
              backgroundColor: headerSoft,
              borderWidth: 1,
              borderColor: isAllTime ? colors.borderStrong : headerAccent,
            }}
          >
            <Ionicons
              name={
                isAllTime
                  ? SCOPE_ICON.all
                  : dayFocus === 'late_missed'
                    ? 'time-outline'
                    : dayFocus === 'at_risk'
                      ? 'alert-circle-outline'
                      : MODE_ICON[dateMode]
              }
              size={12}
              color={headerAccent}
            />
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{ color: headerAccent, fontSize: 11 }}
            >
              {headerModeLabel}
            </AppText>
          </View>
        </View>

        <View
          style={{
            padding: theme.spacing.lg,
            gap: theme.spacing.lg,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
          }}
        >
          <View style={{ gap: theme.spacing.sm }}>
            <AppText
              variant="caption"
              weight={titleWeight}
              style={productionSectionLabelStyle(locale, colors.textMuted)}
            >
              {t('mobile.production.dayLens.origin')}
            </AppText>
            <OriginFocusBar embedded value={origin} onChange={onChangeOrigin} />
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <AppText
              variant="caption"
              weight={titleWeight}
              style={productionSectionLabelStyle(locale, colors.textMuted)}
            >
              {t('mobile.production.dayLens.scope')}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              {(['day', 'all'] as ProductionDateScope[]).map((scope) => {
                const active = dateScope === scope;
                const icon = SCOPE_ICON[scope];
                const label =
                  scope === 'day'
                    ? t('mobile.production.dayLens.byDay')
                    : t('mobile.production.dayLens.allTime');
                return (
                  <PeriodCell
                    key={scope}
                    active={active}
                    icon={icon}
                    label={label}
                    accent={colors.brand}
                    onPress={() => {
                      if (scope === dateScope) return;
                      void haptics.selection();
                      onChangeScope(scope);
                    }}
                  />
                );
              })}
            </View>
          </View>

          {isAllTime ? (
            <View style={productionInsetStyle(theme, colors)}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: theme.spacing.md,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="layers-outline" size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="label" weight={titleWeight}>
                    {t('mobile.production.dayLens.allTimeTitle')}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.production.dayLens.allTimeBody')}
                  </AppText>
                </View>
              </View>
            </View>
          ) : (
            <>
              <View style={{ gap: theme.spacing.sm }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: theme.spacing.md,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <AppText variant="caption" color="muted">
                      {t('mobile.production.dayLens.selectedDay')}
                    </AppText>
                    <AppText
                      variant="heading"
                      weight={titleWeight}
                      dir="ltr"
                      style={{ fontSize: 22, lineHeight: 28, color: colors.textPrimary }}
                    >
                      {selectedLabel}
                    </AppText>
                    <AppText variant="caption" color="secondary" numberOfLines={1}>
                      {weekdayLong}
                      {isToday ? ` · ${t('mobile.production.dayLens.today')}` : ''}
                      {isFuture && !isToday
                        ? ` · ${t('mobile.production.dayLens.futureHint')}`
                        : ''}
                    </AppText>
                  </View>

                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: theme.spacing.xs,
                    }}
                  >
                    <IconWellButton
                      icon="today-outline"
                      active={isToday}
                      label={t('mobile.production.dayLens.today')}
                      onPress={() => onChangeDate(factoryTodayYmd)}
                    />
                    <IconWellButton
                      icon="calendar-outline"
                      active={false}
                      label={t('mobile.production.dayLens.pickDate')}
                      onPress={() => onCalendarOpenChange(true)}
                    />
                  </View>
                </View>
              </View>

              {showTodayPulse ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    style={productionSectionLabelStyle(locale, colors.brand)}
                  >
                    {t('mobile.production.dayLens.todayPulse')}
                  </AppText>
                  <View style={{ gap: theme.spacing.sm }}>
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <PulseCell
                        icon="calendar-outline"
                        label={t('mobile.production.dayLens.plannedToday')}
                        primary={String(plannedOrders)}
                        secondary={t('mobile.production.dayLens.ordersTasksShort', {
                          orders: plannedOrders,
                          tasks: plannedTasks,
                        })}
                        accent={colors.brand}
                        soft={colors.brandSoft}
                        active={dateMode === 'planned' && !dayFocus}
                        onPress={applyPlanned}
                      />
                      <PulseCell
                        icon="pulse-outline"
                        label={t('mobile.production.dayLens.actualSoFar')}
                        primary={String(actualOrders)}
                        secondary={t('mobile.production.dayLens.ordersEventsShort', {
                          orders: actualOrders,
                          events: actualEvents,
                        })}
                        accent={colors.success}
                        soft={colors.successSoft}
                        active={dateMode === 'actual' && !dayFocus}
                        onPress={applyActual}
                      />
                    </View>
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <PulseCell
                        icon="time-outline"
                        label={t('mobile.production.dayLens.lateMissed')}
                        primary={String(lateMissedOrders)}
                        secondary={t('mobile.production.dayLens.ordersTasksShort', {
                          orders: lateMissedOrders,
                          tasks: lateMissedTasks,
                        })}
                        accent={colors.warning}
                        soft={colors.warningSoft}
                        active={dayFocus === 'late_missed'}
                        onPress={applyLate}
                      />
                      <PulseCell
                        icon="alert-circle-outline"
                        label={t('mobile.production.dayLens.atRisk')}
                        primary={String(atRiskOrders)}
                        secondary={t('mobile.production.dayLens.ordersShort')}
                        accent={colors.warning}
                        soft={colors.warningSoft}
                        active={dayFocus === 'at_risk'}
                        onPress={applyAtRisk}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    style={productionSectionLabelStyle(locale, colors.textMuted)}
                  >
                    {t('mobile.production.dayLens.viewMode')}
                  </AppText>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: theme.spacing.sm,
                    }}
                  >
                    {(['planned', 'actual'] as ProductionDateMode[]).map((mode) => {
                      const active = dateMode === mode && !dayFocus;
                      const accent = mode === 'planned' ? colors.brand : colors.success;
                      const label =
                        mode === 'planned'
                          ? t('mobile.production.dayLens.planned')
                          : t('mobile.production.dayLens.actual');
                      return (
                        <PeriodCell
                          key={mode}
                          active={active}
                          icon={MODE_ICON[mode]}
                          label={label}
                          accent={accent}
                          onPress={() => {
                            if (mode === 'planned') applyPlanned();
                            else applyActual();
                          }}
                        />
                      );
                    })}
                  </View>
                </View>
              )}

              {dateMode === 'planned' &&
              summary &&
              summary.planned.byDepartment.length > 0 ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    style={productionSectionLabelStyle(locale, colors.textMuted)}
                  >
                    {t('mobile.production.dayLens.deptHeading')}
                  </AppText>
                  <View style={productionInsetStyle(theme, colors)}>
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        flexWrap: 'wrap',
                        gap: theme.spacing.xs,
                      }}
                    >
                      {summary.planned.byDepartment.slice(0, 8).map((dept) => (
                        <View
                          key={dept.code}
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: theme.spacing.sm,
                            paddingVertical: 6,
                            borderRadius: theme.radius.md,
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <AppText variant="caption" weight={titleWeight} numberOfLines={1}>
                            {departmentChipLabel(dept, locale)}
                          </AppText>
                          <View
                            style={{
                              minWidth: 22,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: theme.radius.full,
                              backgroundColor: colors.brandSoft,
                              alignItems: 'center',
                            }}
                          >
                            <AppText
                              variant="caption"
                              weight={titleWeight}
                              dir="ltr"
                              style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
                            >
                              {dept.taskCount}
                            </AppText>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}
            </>
          )}

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingTop: theme.spacing.xs,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Ionicons name="filter-outline" size={14} color={colors.textMuted} />
            <AppText variant="caption" color="muted" style={{ flex: 1 }}>
              {listHint}
            </AppText>
          </View>
        </View>
      </View>

      <DatePickerSheet
        open={calendarOpen && !isAllTime}
        value={onDate}
        onClose={() => onCalendarOpenChange(false)}
        onSelect={(ymd) => {
          onChangeScope('day');
          onChangeDate(ymd);
          onCalendarOpenChange(false);
        }}
      />
    </>
  );
}

function PeriodCell({
  active,
  icon,
  label,
  accent,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent: string;
  onPress: () => void;
}) {
  const { colors, theme, colorScheme } = useTheme();
  const { locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 56,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: active ? accent : colors.borderStrong,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
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
            backgroundColor: accent,
          }}
        />
      ) : null}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: active ? accent : colors.border,
        }}
      >
        <Ionicons name={icon} size={16} color={active ? accent : colors.textSecondary} />
      </View>
      <AppText
        variant="caption"
        weight={titleWeight}
        numberOfLines={2}
        align="center"
        style={{
          fontSize: 11,
          lineHeight: 14,
          color: active ? accent : colors.textSecondary,
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

function IconWellButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minWidth: 52,
        minHeight: theme.sizes.touch.min,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.lg,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        ...orderBoardShadow(colorScheme),
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
          borderColor: active ? colors.brand : colors.border,
        }}
      >
        <Ionicons
          name={icon}
          size={14}
          color={active ? colors.brand : colors.textSecondary}
        />
      </View>
      <AppText
        variant="caption"
        numberOfLines={1}
        style={{
          fontSize: 9,
          maxWidth: 56,
          textAlign: 'center',
          color: active ? colors.brand : colors.textMuted,
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

function PulseCell({
  icon,
  label,
  primary,
  secondary,
  accent,
  soft,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  soft: string;
  active: boolean;
  onPress: () => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 88,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: active ? accent : colors.borderStrong,
        backgroundColor: active ? soft : colors.surfaceSecondary,
        padding: theme.spacing.sm,
        gap: 4,
        overflow: 'hidden',
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
            backgroundColor: accent,
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: active ? accent : colors.border,
          }}
        >
          <Ionicons name={icon} size={13} color={accent} />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={2}
          style={{ flex: 1, color: active ? accent : colors.textSecondary, fontSize: 11 }}
        >
          {label}
        </AppText>
      </View>
      <AppText
        variant="heading"
        weight={titleWeight}
        dir="ltr"
        style={{
          fontSize: 22,
          color: accent,
          fontVariant: ['tabular-nums'],
          ...(isRTL ? { textAlign: 'right' } : { textAlign: 'left' }),
        }}
      >
        {primary}
      </AppText>
      <AppText variant="caption" color="muted" numberOfLines={1}>
        {secondary}
      </AppText>
    </AnimatedPressable>
  );
}
