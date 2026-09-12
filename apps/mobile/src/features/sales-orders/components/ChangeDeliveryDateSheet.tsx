import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import {
  MonthCalendar,
  CalendarLegend,
  initialCursorFromValue,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerFormError, DealerFormFooter } from '@/features/dealers/components/dealerSheetForm';
import { formatDate, useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useAvailabilityQuery } from '@/features/scheduling/query';
import {
  selectAvailabilityDayMeta,
  selectDeliveryAvailability,
  toDeliveryYmd,
} from '@/features/requests/selectDeliveryAvailability';
import type { ChangeDateCtaMode } from '../selectSchedulePromise';

type Props = {
  open: boolean;
  onClose: () => void;
  mode: ChangeDateCtaMode;
  current?: string | null;
  /** Product lines used to re-check availability for the calendar. */
  availabilityItems?: Array<{ productId: string; quantity: number }>;
  loading?: boolean;
  errorMessage?: string | null;
  onSubmit: (isoDate: string) => void;
};

/**
 * Dealer preferred-delivery-date sheet with availability-aware month calendar.
 */
export function ChangeDeliveryDateSheet({
  open,
  onClose,
  mode,
  current,
  availabilityItems,
  loading,
  errorMessage,
  onSubmit,
}: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const initial = current ? current.slice(0, 10) : '';
  const [value, setValue] = useState(initial);
  const [cursor, setCursor] = useState<CalendarCursor>(() =>
    initialCursorFromValue(initial || todayYmd()),
  );

  useEffect(() => {
    if (open) {
      const ymd = current ? current.slice(0, 10) : '';
      setValue(ymd);
      setCursor(initialCursorFromValue(ymd || todayYmd()));
    }
  }, [open, current]);

  const items = availabilityItems ?? [];
  const availabilityRequest =
    open && items.length > 0
      ? {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          requestedDeliveryDate: value || undefined,
        }
      : null;
  const availabilityQuery = useAvailabilityQuery(availabilityRequest);

  const display = useMemo(
    () =>
      selectDeliveryAvailability({
        hasItems: items.length > 0,
        isLoading: availabilityQuery.isLoading && !availabilityQuery.data,
        isError: availabilityQuery.isError,
        result: availabilityQuery.data,
        requestedDeliveryDate: value,
      }),
    [
      availabilityQuery.data,
      availabilityQuery.isError,
      availabilityQuery.isLoading,
      items.length,
      value,
    ],
  );

  const availabilityUpdating =
    availabilityQuery.isFetching && Boolean(availabilityQuery.data);
  const dayMeta = useMemo(
    () =>
      selectAvailabilityDayMeta({
        display,
        year: cursor.y,
        monthIndex: cursor.m,
      }),
    [cursor.m, cursor.y, display],
  );

  const title =
    mode === 'request'
      ? t('mobile.orderDetail.schedule.requestDateChangeTitle')
      : t('mobile.orderDetail.schedule.changeDateTitle');
  const body =
    mode === 'request'
      ? t('mobile.orderDetail.schedule.requestDateChangeBody')
      : t('mobile.orderDetail.schedule.changeDateBody');
  const confirmLabel =
    mode === 'request'
      ? t('mobile.orderDetail.schedule.sendRequest')
      : t('mobile.orderDetail.schedule.saveDate');

  const canSubmit = Boolean(toDeliveryYmd(value));

  return (
    <BottomSheet open={open} onClose={onClose} title={title} expandable sheetHeight={640}>
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AppText variant="body" color="secondary">
            {body}
          </AppText>

          {display.kind === 'loading' && !availabilityUpdating ? (
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.delivery.checking')}
            </AppText>
          ) : null}

          {display.kind === 'infeasible' ? (
            <AppText variant="caption" style={{ color: colors.warning }}>
              {display.suggestedDate
                ? t('mobile.newOrder.delivery.infeasibleWithSuggestion', {
                    date: formatDate(locale, display.suggestedDate),
                  })
                : t('mobile.newOrder.delivery.infeasible')}
            </AppText>
          ) : null}

          <DealerBoard
            title={t('mobile.dealerAccount.calendarMonthTitle')}
            titleWeight={titleWeight}
          >
            <View style={{ opacity: availabilityUpdating ? 0.72 : 1, gap: theme.spacing.sm }}>
              <CalendarLegend variant="dealer" compact />
              <MonthCalendar
                value={value}
                onSelect={setValue}
                monthCursor={cursor}
                onMonthChange={setCursor}
                dayMeta={dayMeta}
                minDate={display.earliestDate ?? undefined}
                disableUnavailable
                variant="dealer"
              />
            </View>
          </DealerBoard>

          {value ? (
            <AppText variant="caption" color="secondary">
              {t('mobile.newOrder.delivery.selectedDate', {
                date: formatDate(locale, value),
              })}
            </AppText>
          ) : null}

          {errorMessage ? <DealerFormError message={errorMessage} /> : null}
        </ScrollView>

        <DealerFormFooter
          confirmLabel={confirmLabel}
          onConfirm={() => {
            const ymd = toDeliveryYmd(value);
            if (!ymd) return;
            void haptics.confirmMedium();
            onSubmit(`${ymd}T12:00:00.000Z`);
          }}
          onCancel={onClose}
          loading={loading}
          disabled={loading || !canSubmit}
        />
      </View>
    </BottomSheet>
  );
}
