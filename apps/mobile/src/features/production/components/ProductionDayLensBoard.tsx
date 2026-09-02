import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DatePickerSheet, formatYmdLabel } from '@/components/calendar';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionDateMode, ProductionDaySummary } from '../api';
import { productionInsetStyle, productionSectionLabelStyle } from '../productionFloorStyle';

type ProductionDateScope = 'day' | 'all';

type Props = {
  dateScope: ProductionDateScope;
  onDate: string;
  dateMode: ProductionDateMode;
  factoryTodayYmd: string;
  summary: ProductionDaySummary | null;
  onChangeScope: (scope: ProductionDateScope) => void;
  onChangeDate: (ymd: string) => void;
  onChangeMode: (mode: ProductionDateMode) => void;
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

/**
 * Factory day lens — parchment desk calendar for Planned vs Actual.
 * View/filter only; matches production hub + reports period chrome.
 */
export function ProductionDayLensBoard({
  dateScope,
  onDate,
  dateMode,
  factoryTodayYmd,
  summary,
  onChangeScope,
  onChangeDate,
  onChangeMode,
  calendarOpen,
  onCalendarOpenChange,
}: Props) {
  const { t, locale, isRTL, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const isAllTime = dateScope === 'all';
  const isToday = onDate === factoryTodayYmd;
  const isFuture = summary?.isFuture ?? onDate > factoryTodayYmd;

  const selectedLabel = formatYmdLabel(onDate, formatDate);
  const weekdayLong = (() => {
    const d = new Date(`${onDate}T12:00:00Z`);
    return d.toLocaleDateString(locale, { weekday: 'long' });
  })();

  const plannedOrders = summary?.planned.orders ?? 0;
  const plannedTasks = summary?.planned.tasks ?? 0;
  const actualOrders = summary?.actual.orders ?? 0;
  const actualEvents = summary?.actual.taskEvents ?? 0;

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
        {/* Accent rail */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: isAllTime
              ? colors.surfaceSecondary
              : dateMode === 'planned'
                ? colors.brand
                : colors.success,
            opacity: isAllTime ? 0.45 : 0.65,
          }}
        />

        {/* Header band */}
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
              backgroundColor: isAllTime
                ? colors.surfaceSecondary
                : dateMode === 'planned'
                  ? colors.brandSoft
                  : colors.successSoft,
              borderWidth: 1,
              borderColor: isAllTime
                ? colors.borderStrong
                : dateMode === 'planned'
                  ? colors.brand
                  : colors.success,
            }}
          >
            <Ionicons
              name={isAllTime ? SCOPE_ICON.all : MODE_ICON[dateMode]}
              size={12}
              color={
                isAllTime
                  ? colors.textSecondary
                  : dateMode === 'planned'
                    ? colors.brand
                    : colors.success
              }
            />
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{
                color: isAllTime
                  ? colors.textSecondary
                  : dateMode === 'planned'
                    ? colors.brand
                    : colors.success,
                fontSize: 11,
              }}
            >
              {isAllTime
                ? t('mobile.production.dayLens.allTime')
                : dateMode === 'planned'
                  ? t('mobile.production.dayLens.planned')
                  : t('mobile.production.dayLens.actual')}
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
          {/* Scope — by day vs all time */}
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
                  <AnimatedPressable
                    key={scope}
                    variant="button"
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      if (scope === dateScope) return;
                      void haptics.selection();
                      onChangeScope(scope);
                    }}
                    style={{
                      flex: 1,
                      minHeight: 56,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.borderStrong,
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
                          backgroundColor: colors.brand,
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
                        borderColor: active ? colors.brand : colors.border,
                      }}
                    >
                      <Ionicons
                        name={icon}
                        size={16}
                        color={active ? colors.brand : colors.textSecondary}
                      />
                    </View>
                    <AppText
                      variant="caption"
                      weight={titleWeight}
                      numberOfLines={2}
                      align="center"
                      style={{
                        fontSize: 11,
                        lineHeight: 14,
                        color: active ? colors.brand : colors.textSecondary,
                      }}
                    >
                      {label}
                    </AppText>
                  </AnimatedPressable>
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
          {/* Hero selected day */}
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

          {/* Mode cells — reports period style */}
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
                const active = dateMode === mode;
                const icon = MODE_ICON[mode];
                const label =
                  mode === 'planned'
                    ? t('mobile.production.dayLens.planned')
                    : t('mobile.production.dayLens.actual');
                return (
                  <AnimatedPressable
                    key={mode}
                    variant="button"
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      if (mode === dateMode) return;
                      void haptics.selection();
                      onChangeMode(mode);
                    }}
                    style={{
                      flex: 1,
                      minHeight: 56,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: active
                        ? mode === 'planned'
                          ? colors.brand
                          : colors.success
                        : colors.borderStrong,
                      backgroundColor: active
                        ? mode === 'planned'
                          ? colors.brandSoft
                          : colors.successSoft
                        : colors.surfaceSecondary,
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
                          backgroundColor:
                            mode === 'planned' ? colors.brand : colors.success,
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
                        borderColor: active
                          ? mode === 'planned'
                            ? colors.brand
                            : colors.success
                          : colors.border,
                      }}
                    >
                      <Ionicons
                        name={icon}
                        size={16}
                        color={
                          active
                            ? mode === 'planned'
                              ? colors.brand
                              : colors.success
                            : colors.textSecondary
                        }
                      />
                    </View>
                    <AppText
                      variant="caption"
                      weight={titleWeight}
                      numberOfLines={2}
                      align="center"
                      style={{
                        fontSize: 11,
                        lineHeight: 14,
                        color: active
                          ? mode === 'planned'
                            ? colors.brand
                            : colors.success
                          : colors.textSecondary,
                      }}
                    >
                      {label}
                    </AppText>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>

          {/* Today pulse metrics */}
          {summary?.isToday ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText
                variant="caption"
                weight={titleWeight}
                style={productionSectionLabelStyle(locale, colors.brand)}
              >
                {t('mobile.production.dayLens.todayPulse')}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.sm,
                }}
              >
                <MetricTile
                  icon="calendar-outline"
                  label={t('mobile.production.dayLens.plannedToday')}
                  primary={String(plannedOrders)}
                  secondary={t('mobile.production.dayLens.ordersTasksShort', {
                    orders: plannedOrders,
                    tasks: plannedTasks,
                  })}
                  accent={colors.brand}
                  active={dateMode === 'planned'}
                  onPress={() => onChangeMode('planned')}
                />
                <MetricTile
                  icon="pulse-outline"
                  label={t('mobile.production.dayLens.actualSoFar')}
                  primary={String(actualOrders)}
                  secondary={t('mobile.production.dayLens.ordersEventsShort', {
                    orders: actualOrders,
                    events: actualEvents,
                  })}
                  accent={colors.success}
                  active={dateMode === 'actual'}
                  onPress={() => onChangeMode('actual')}
                />
              </View>

              {(summary.lateMissed > 0 || summary.atRisk > 0) && (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: theme.spacing.sm,
                  }}
                >
                  {summary.lateMissed > 0 ? (
                    <MetricTile
                      icon="time-outline"
                      label={t('mobile.production.dayLens.lateMissed')}
                      primary={String(summary.lateMissed)}
                      secondary={t('mobile.production.dayLens.tasksShort')}
                      accent={colors.warning}
                      compact
                      onPress={() => onChangeMode('planned')}
                    />
                  ) : null}
                  {summary.atRisk > 0 ? (
                    <MetricTile
                      icon="alert-circle-outline"
                      label={t('mobile.production.dayLens.atRisk')}
                      primary={String(summary.atRisk)}
                      secondary={t('mobile.production.dayLens.ordersShort')}
                      accent={colors.warning}
                      compact
                      onPress={() => onChangeMode('planned')}
                    />
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {/* Department breakdown — planned mode */}
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
                        {dept.nameEn}
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

          {/* Scoped list hint */}
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
              {isAllTime
                ? t('mobile.production.dayLens.listHintAllTime')
                : dateMode === 'planned'
                  ? t('mobile.production.dayLens.listHintPlanned', { date: selectedLabel })
                  : t('mobile.production.dayLens.listHintActual', { date: selectedLabel })}
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

function MetricTile({
  icon,
  label,
  primary,
  secondary,
  accent,
  active,
  compact,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  active?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <AnimatedPressable
      variant="button"
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flex: compact ? 1 : undefined,
        flexBasis: compact ? undefined : '48%',
        flexGrow: compact ? 1 : 0,
        minWidth: compact ? 0 : 140,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: active ? accent : colors.borderStrong,
        backgroundColor: active ? colors.surfaceSecondary : colors.surface,
        padding: compact ? theme.spacing.sm : theme.spacing.md,
        gap: theme.spacing.xs,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <View
          style={{
            width: compact ? 26 : 30,
            height: compact ? 26 : 30,
            borderRadius: compact ? 13 : 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name={icon} size={compact ? 13 : 15} color={accent} />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={2}
          style={{ flex: 1, color: colors.textSecondary, fontSize: compact ? 10 : 11 }}
        >
          {label}
        </AppText>
      </View>
      <AppText
        variant="heading"
        weight={titleWeight}
        dir="ltr"
        style={{
          fontSize: compact ? 20 : 24,
          color: accent,
          fontVariant: ['tabular-nums'],
          ...(isRTL ? { textAlign: 'right' } : { textAlign: 'left' }),
        }}
      >
        {primary}
      </AppText>
      {!compact ? (
        <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
          {secondary}
        </AppText>
      ) : null}
    </AnimatedPressable>
  );
}
