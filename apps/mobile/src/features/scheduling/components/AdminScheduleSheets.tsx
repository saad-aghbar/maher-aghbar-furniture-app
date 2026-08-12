import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import {
  MonthCalendar,
  initialCursorFromValue,
  todayYmd,
  type DayMeta,
} from '@/components/calendar';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { isValidOptionalDate } from '@/features/requests/newOrderValidation';

function SheetFooter({
  confirmLabel,
  cancelLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const busy = Boolean(loading);
  return (
    <View
      style={{
        marginTop: 'auto',
        paddingTop: theme.spacing.md,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
      }}
    >
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        disabled={busy}
        onPress={() => {
          void haptics.selection();
          onCancel();
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
          opacity: busy ? 0.55 : 1,
        }}
      >
        <AppText variant="label" weight="medium" style={{ color: colors.textSecondary }}>
          {cancelLabel}
        </AppText>
      </AnimatedPressable>

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={confirmLabel}
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={() => {
          void haptics.confirmMedium();
          onConfirm();
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
          backgroundColor: colors.brand,
          opacity: busy ? 0.75 : 1,
          ...(colorScheme === 'dark'
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
              }),
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.onBrand} />
        ) : (
          <>
            <AppText variant="label" weight="semibold" style={{ color: colors.onBrand }}>
              {confirmLabel}
            </AppText>
            <Ionicons name="checkmark" size={18} color={colors.onBrand} />
          </>
        )}
      </AnimatedPressable>
    </View>
  );
}

type ApproveSheetProps = {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  loading?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
};

export function ApproveScheduleSheet({
  open,
  onClose,
  orderNumber,
  loading,
  errorMessage,
  onConfirm,
}: ApproveSheetProps) {
  const { t } = useLocale();
  const { theme } = useTheme();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.sheets.approveTitle')}
      sheetHeight={320}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <AppText variant="body" color="secondary">
          {t('mobile.adminScheduling.sheets.approveBody', { number: orderNumber })}
        </AppText>
        {errorMessage ? (
          <AppText variant="caption" color="error">
            {errorMessage}
          </AppText>
        ) : null}
        <SheetFooter
          confirmLabel={t('mobile.adminScheduling.sheets.approveConfirm')}
          cancelLabel={t('mobile.production.cancel')}
          loading={loading}
          onConfirm={onConfirm}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}

type ChangeDateSheetProps = {
  open: boolean;
  onClose: () => void;
  current?: string | null;
  /** Working YMD set from factory calendar (optional). */
  workingDays?: Set<string>;
  loading?: boolean;
  errorMessage?: string | null;
  onSubmit: (isoDate: string, reason?: string) => void;
};

export function AdminChangeScheduleDateSheet({
  open,
  onClose,
  current,
  workingDays,
  loading,
  errorMessage,
  onSubmit,
}: ChangeDateSheetProps) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const [value, setValue] = useState(current ? current.slice(0, 10) : '');
  const [reason, setReason] = useState('');
  const [formatError, setFormatError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() =>
    initialCursorFromValue(current ? current.slice(0, 10) : todayYmd()),
  );

  useEffect(() => {
    if (open) {
      const ymd = current ? current.slice(0, 10) : '';
      setValue(ymd);
      setReason('');
      setFormatError(null);
      setCursor(initialCursorFromValue(ymd || todayYmd()));
    }
  }, [open, current]);

  const dayMeta = useMemo(() => {
    const last = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const meta: Record<string, DayMeta> = {};
    for (let d = 1; d <= last; d++) {
      const ymd = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (workingDays && !workingDays.has(ymd)) {
        meta[ymd] = { tone: 'closed', disabled: true };
      } else {
        meta[ymd] = { tone: 'empty', disabled: false };
      }
    }
    return meta;
  }, [cursor.m, cursor.y, workingDays]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.sheets.changeDateTitle')}
      sheetHeight={640}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <MonthCalendar
            value={value}
            onSelect={(ymd) => {
              setValue(ymd);
              setFormatError(null);
            }}
            monthCursor={cursor}
            onMonthChange={setCursor}
            dayMeta={dayMeta}
            disableUnavailable
            variant="admin"
          />

          {formatError ? (
            <AppText variant="caption" color="error">
              {formatError}
            </AppText>
          ) : null}

          <TextField
            label={t('mobile.adminScheduling.sheets.reasonLabel')}
            value={reason}
            onChangeText={setReason}
            placeholder={t('mobile.adminScheduling.sheets.reasonPlaceholder')}
            multiline
            growMinHeight={64}
          />

          {errorMessage ? (
            <AppText variant="caption" color="error">
              {errorMessage}
            </AppText>
          ) : null}
        </ScrollView>

        <SheetFooter
          confirmLabel={t('mobile.adminScheduling.sheets.saveDate')}
          cancelLabel={t('mobile.production.cancel')}
          loading={loading}
          onConfirm={() => {
            const trimmed = value.trim();
            if (!trimmed || !isValidOptionalDate(trimmed)) {
              setFormatError(t('mobile.production.deliveryDateInvalid'));
              return;
            }
            setFormatError(null);
            onSubmit(`${trimmed}T12:00:00.000Z`, reason.trim() || undefined);
          }}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}

type RecalculateSheetProps = {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  loading?: boolean;
  errorMessage?: string | null;
  onSubmit: (reason?: string) => void;
};

export function RecalculateScheduleSheet({
  open,
  onClose,
  orderNumber,
  loading,
  errorMessage,
  onSubmit,
}: RecalculateSheetProps) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.sheets.recalculateTitle')}
      sheetHeight={420}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <AppText variant="body" color="secondary">
          {t('mobile.adminScheduling.sheets.recalculateBody', { number: orderNumber })}
        </AppText>
        <TextField
          label={t('mobile.adminScheduling.sheets.reasonLabel')}
          value={reason}
          onChangeText={setReason}
          placeholder={t('mobile.adminScheduling.sheets.reasonPlaceholder')}
          multiline
          growMinHeight={64}
        />
        {errorMessage ? (
          <AppText variant="caption" color="error">
            {errorMessage}
          </AppText>
        ) : null}
        <SheetFooter
          confirmLabel={t('mobile.adminScheduling.sheets.recalculateConfirm')}
          cancelLabel={t('mobile.production.cancel')}
          loading={loading}
          onConfirm={() => onSubmit(reason.trim() || undefined)}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}

type DayExceptionSheetProps = {
  open: boolean;
  onClose: () => void;
  dateYmd: string;
  isWorking: boolean;
  hasException: boolean;
  defaultShiftStart?: string;
  defaultShiftEnd?: string;
  loading?: boolean;
  errorMessage?: string | null;
  onOpenDay: () => void;
  onCloseDay: () => void;
  onOvertime: (endHm: string) => void;
  onClearException: () => void;
};

/** Open / close / overtime / clear for any selected calendar day. */
export function AdminDayExceptionSheet({
  open,
  onClose,
  dateYmd,
  isWorking,
  hasException,
  defaultShiftStart = '08:00',
  defaultShiftEnd = '16:00',
  loading,
  errorMessage,
  onOpenDay,
  onCloseDay,
  onOvertime,
  onClearException,
}: DayExceptionSheetProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const [overtimeEnd, setOvertimeEnd] = useState('20:00');
  const busy = Boolean(loading);

  useEffect(() => {
    if (open) setOvertimeEnd('20:00');
  }, [open, dateYmd]);

  const ActionBtn = ({
    label,
    onPress,
    destructive,
  }: {
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }) => (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={() => {
        void haptics.confirmMedium();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        backgroundColor: destructive ? colors.errorSoft : colors.brandSoft,
        borderWidth: 1,
        borderColor: destructive ? colors.error : colors.brand,
        opacity: busy ? 0.55 : 1,
      }}
    >
      <AppText
        variant="label"
        weight="semibold"
        style={{ color: destructive ? colors.error : colors.brand }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.dayCapacity.title', { date: dateYmd })}
      sheetHeight={520}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <AppText variant="caption" color="muted">
          {t('mobile.adminScheduling.dayCapacity.body')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t('mobile.adminScheduling.dayCapacity.normalShift', {
            start: defaultShiftStart,
            end: defaultShiftEnd,
          })}
        </AppText>

        {busy ? <ActivityIndicator color={colors.brand} /> : null}

        <View style={{ gap: theme.spacing.sm }}>
          {!isWorking ? (
            <ActionBtn label={t('mobile.adminScheduling.dayCapacity.open')} onPress={onOpenDay} />
          ) : null}

          {isWorking ? (
            <>
              <TextField
                label={t('mobile.adminScheduling.dayCapacity.overtimeUntil')}
                value={overtimeEnd}
                onChangeText={setOvertimeEnd}
                placeholder="20:00"
                autoCapitalize="none"
              />
              <ActionBtn
                label={t('mobile.adminScheduling.dayCapacity.addOvertime')}
                onPress={() => onOvertime(overtimeEnd.trim() || '20:00')}
              />
              <ActionBtn
                label={t('mobile.adminScheduling.dayCapacity.close')}
                onPress={onCloseDay}
                destructive
              />
            </>
          ) : null}

          {hasException ? (
            <ActionBtn
              label={t('mobile.adminScheduling.dayCapacity.clear')}
              onPress={onClearException}
              destructive
            />
          ) : null}
        </View>

        {errorMessage ? (
          <AppText variant="caption" color="error">
            {errorMessage}
          </AppText>
        ) : null}

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.production.cancel')}
          disabled={busy}
          onPress={() => {
            void haptics.selection();
            onClose();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText variant="label" weight="medium" style={{ color: colors.textSecondary }}>
            {t('mobile.production.cancel')}
          </AppText>
        </AnimatedPressable>
      </View>
    </BottomSheet>
  );
}
