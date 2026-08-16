import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import {
  MonthCalendar,
  CalendarLegend,
  initialCursorFromValue,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { formatDate, useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  selectAvailabilityDayMeta,
  selectQuickPickDates,
  toDeliveryYmd,
  type DeliveryAvailabilityDisplay,
} from '../selectDeliveryAvailability';

type Props = {
  display: DeliveryAvailabilityDisplay;
  requestedDeliveryDate: string;
  onChangeDate: (ymd: string) => void;
  /** Field-level validation error (invalid format), separate from feasibility. */
  dateError?: string;
  /** Soft in-place refresh — never unmount the calendar. */
  updating?: boolean;
};

function DateChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 36,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.brand : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
      }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        style={{ color: active ? colors.onBrand : colors.textSecondary }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Dealer-facing delivery-window card — earliest date, quick chips, and an
 * availability-aware month calendar (no YYYY-MM-DD text field).
 */
export function DeliveryAvailabilityCard({
  display,
  requestedDeliveryDate,
  onChangeDate,
  dateError,
  updating = false,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const selectedYmd = toDeliveryYmd(requestedDeliveryDate) ?? '';
  const [cursor, setCursor] = useState<CalendarCursor>(() =>
    initialCursorFromValue(selectedYmd || display.earliestDate || todayYmd()),
  );
  const anchoredEarliest = useRef(Boolean(selectedYmd || display.earliestDate));

  // Jump month only when the user picks a date / chip — never on availability refetch.
  useEffect(() => {
    if (!selectedYmd) return;
    const next = initialCursorFromValue(selectedYmd);
    setCursor((prev) => (prev.y === next.y && prev.m === next.m ? prev : next));
  }, [selectedYmd]);

  // First time earliest arrives with no selection, open that month once.
  useEffect(() => {
    if (selectedYmd || !display.earliestDate || anchoredEarliest.current) return;
    anchoredEarliest.current = true;
    const next = initialCursorFromValue(display.earliestDate);
    setCursor((prev) => (prev.y === next.y && prev.m === next.m ? prev : next));
  }, [display.earliestDate, selectedYmd]);

  const dayMeta = useMemo(
    () =>
      selectAvailabilityDayMeta({
        display,
        year: cursor.y,
        monthIndex: cursor.m,
      }),
    [cursor.m, cursor.y, display],
  );

  if (display.kind === 'idle') return null;

  const quickDates = selectQuickPickDates(display);
  const showCalendar = display.kind === 'feasible' || display.kind === 'infeasible';

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor:
          display.kind === 'infeasible' ? colors.warning : colors.border,
        backgroundColor:
          display.kind === 'infeasible' ? colors.warningSoft : colors.surfaceSecondary,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
        opacity: updating ? 0.72 : 1,
      }}
    >
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
            backgroundColor: colors.brandSoft,
          }}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.brand} />
        </View>
        <AppText variant="label" weight="semibold" style={{ flex: 1 }}>
          {t('mobile.newOrder.delivery.title')}
        </AppText>
      </View>

      {display.kind === 'loading' ? (
        <AppText variant="caption" color="muted">
          {t('mobile.newOrder.delivery.checking')}
        </AppText>
      ) : null}

      {display.kind === 'error' ? (
        <AppText variant="caption" color="muted">
          {t('mobile.newOrder.delivery.checkFailed')}
        </AppText>
      ) : null}

      {display.kind === 'unavailable' ? (
        <AppText variant="caption" color="muted">
          {t('mobile.newOrder.delivery.unavailable')}
        </AppText>
      ) : null}

      {showCalendar ? (
        <>
          {display.earliestDate ? (
            <AppText variant="caption" color="secondary">
              {t('mobile.newOrder.delivery.earliest', {
                date: formatDate(locale, display.earliestDate),
              })}
            </AppText>
          ) : null}

          {display.kind === 'infeasible' ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: theme.spacing.xs,
              }}
            >
              <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
              <AppText
                variant="caption"
                style={{ flex: 1, color: colors.warning }}
              >
                {display.suggestedDate
                  ? t('mobile.newOrder.delivery.infeasibleWithSuggestion', {
                      date: formatDate(locale, display.suggestedDate),
                    })
                  : t('mobile.newOrder.delivery.infeasible')}
              </AppText>
            </View>
          ) : null}

          {quickDates.length > 0 ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.xs,
              }}
            >
              {quickDates.map((d, i) => {
                const ymd = toDeliveryYmd(d) ?? d;
                return (
                  <DateChip
                    key={ymd}
                    label={
                      i === 0
                        ? t('mobile.newOrder.delivery.earliestChip')
                        : formatDate(locale, ymd)
                    }
                    active={selectedYmd === ymd}
                    onPress={() => {
                      onChangeDate(ymd);
                      setCursor(initialCursorFromValue(ymd));
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          <CalendarLegend variant="dealer" compact />

          <MonthCalendar
            value={selectedYmd}
            onSelect={(ymd) => onChangeDate(ymd)}
            monthCursor={cursor}
            onMonthChange={setCursor}
            dayMeta={dayMeta}
            minDate={display.earliestDate ?? undefined}
            disableUnavailable
            variant="dealer"
            compact
          />

          {selectedYmd ? (
            <AppText variant="caption" color="secondary">
              {t('mobile.newOrder.delivery.selectedDate', {
                date: formatDate(locale, selectedYmd),
              })}
            </AppText>
          ) : (
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.delivery.customDateHint')}
            </AppText>
          )}

          {dateError ? (
            <AppText variant="caption" color="error">
              {dateError}
            </AppText>
          ) : null}

          {display.isPreliminary ? (
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.delivery.preliminaryNote')}
            </AppText>
          ) : null}
        </>
      ) : null}
      <AppText variant="caption" color="muted">
        {t('mobile.newOrder.delivery.confirmAfterCheck')}
      </AppText>
    </View>
  );
}
