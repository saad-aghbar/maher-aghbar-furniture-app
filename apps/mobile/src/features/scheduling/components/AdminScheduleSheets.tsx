import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import {
  MonthCalendar,
  formatYmdLabel,
  initialCursorFromValue,
  todayYmd,
  type DayMeta,
} from '@/components/calendar';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { OrderCardMedia } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { isValidOptionalDate } from '@/features/requests/newOrderValidation';
import { formatCompactHours, formatTime, formatTimeRange, useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  canStepOvertime,
  defaultOvertimeEnd,
  overtimeExtraMinutes,
  overtimeHoursLabel,
  stepOvertimeEnd,
} from '../selectDayCapacity';
import {
  blockerKindI18nKey,
  type SyncScheduleSheetPhase,
  type SyncScheduleStats,
} from '../syncScheduleUi';
import {
  type OptimizeScheduleSheetPhase,
  type OptimizeScheduleStats,
} from '../optimizeScheduleUi';

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
        paddingTop: theme.spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
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

function ConfirmCopyBoard({
  icon,
  orderNumber,
  body,
  errorMessage,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  orderNumber: string;
  body: string;
  errorMessage?: string | null;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

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
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
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
              width: 40,
              height: 40,
              borderRadius: theme.radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={icon} size={18} color={colors.brand} />
          </View>
          {orderNumber ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: colors.brandSoft,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.brand,
              }}
            >
              <AppText
                variant="caption"
                weight={titleWeight}
                dir="ltr"
                numberOfLines={1}
                style={{ color: colors.brand }}
              >
                {orderNumber}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText
          variant="body"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 22 }}
        >
          {body}
        </AppText>
        {errorMessage ? (
          <AppText variant="caption" color="error">
            {errorMessage}
          </AppText>
        ) : null}
      </View>
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
  const { height } = useWindowDimensions();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.sheets.approveTitle')}
      fitContent
      maxHeight={Math.round(height * 0.48)}
    >
      <View style={{ gap: theme.spacing.md }}>
        <ConfirmCopyBoard
          icon="checkmark-circle-outline"
          orderNumber={orderNumber}
          body={t('mobile.adminScheduling.sheets.approveBody', { number: orderNumber })}
          errorMessage={errorMessage}
        />
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
  const { height } = useWindowDimensions();
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
      sheetHeight={Math.min(Math.round(height * 0.62), 560)}
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
  const { height } = useWindowDimensions();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.sheets.recalculateTitle')}
      fitContent
      maxHeight={Math.round(height * 0.56)}
    >
      <View style={{ gap: theme.spacing.md }}>
        <ConfirmCopyBoard
          icon="refresh-outline"
          orderNumber={orderNumber}
          body={t('mobile.adminScheduling.sheets.recalculateBody', { number: orderNumber })}
          errorMessage={errorMessage}
        />
        <TextField
          label={t('mobile.adminScheduling.sheets.reasonLabel')}
          value={reason}
          onChangeText={setReason}
          placeholder={t('mobile.adminScheduling.sheets.reasonPlaceholder')}
          multiline
          growMinHeight={64}
        />
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
  currentOvertimeEnd?: string | null;
  loading?: boolean;
  errorMessage?: string | null;
  onOpenDay: () => void;
  onCloseDay: () => void;
  onOvertime: (endHm: string) => void;
  onClearException: () => void;
};

function DayCapacityCard({
  children,
  accent,
}: {
  children: ReactNode;
  accent: string;
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
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        {children}
      </View>
    </View>
  );
}

function OvertimeStepper({
  value,
  shiftEnd,
  disabled,
  onChange,
}: {
  value: string;
  shiftEnd: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const { t, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const canEarlier = canStepOvertime(value, shiftEnd, -1);
  const canLater = canStepOvertime(value, shiftEnd, 1);
  const extraHours = overtimeHoursLabel(overtimeExtraMinutes(shiftEnd, value));

  const bump = (delta: number) => {
    if (disabled) return;
    const next = stepOvertimeEnd(value, shiftEnd, delta);
    if (next === value) return;
    void haptics.selection();
    onChange(next);
  };

  const StepBtn = ({
    earlier,
    enabled,
  }: {
    earlier: boolean;
    enabled: boolean;
  }) => (
    <AnimatedPressable
      variant="button"
      disabled={disabled || !enabled}
      accessibilityRole="button"
      accessibilityLabel={
        earlier
          ? t('mobile.adminScheduling.dayCapacity.overtimeEarlier')
          : t('mobile.adminScheduling.dayCapacity.overtimeLater')
      }
      onPress={() => bump(earlier ? -1 : 1)}
      style={{
        width: theme.sizes.touch.min + 4,
        height: theme.sizes.touch.min + 4,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: enabled ? colors.brandSoft : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: enabled ? colors.brand : colors.border,
        opacity: disabled || !enabled ? 0.4 : 1,
      }}
    >
      <Ionicons
        name={earlier ? 'remove' : 'add'}
        size={22}
        color={enabled ? colors.brand : colors.textMuted}
      />
    </AnimatedPressable>
  );

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" color="secondary">
        {t('mobile.adminScheduling.dayCapacity.overtimeUntil')}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.xl,
          backgroundColor: dark ? 'rgba(255,255,255,0.06)' : colors.brandSoft,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: dark ? 'rgba(255,255,255,0.12)' : colors.brand,
        }}
      >
        <StepBtn earlier enabled={canEarlier} />
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <AppText variant="largeTitle" weight="semibold" dir="ltr">
            {value}
          </AppText>
          <AppText variant="caption" color="secondary">
            {t('mobile.adminScheduling.dayCapacity.overtimeExtra', {
              hours: formatCompactHours(locale, extraHours),
              end: formatTime(locale, shiftEnd),
            })}
          </AppText>
        </View>
        <StepBtn earlier={false} enabled={canLater} />
      </View>
    </View>
  );
}

/** Open / close / overtime / clear for any selected calendar day. */
export function AdminDayExceptionSheet({
  open,
  onClose,
  dateYmd,
  isWorking,
  hasException,
  defaultShiftStart = '08:00',
  defaultShiftEnd = '16:00',
  currentOvertimeEnd,
  loading,
  errorMessage,
  onOpenDay,
  onCloseDay,
  onOvertime,
  onClearException,
}: DayExceptionSheetProps) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const [overtimeEnd, setOvertimeEnd] = useState(() => defaultOvertimeEnd(defaultShiftEnd));
  const busy = Boolean(loading);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dateLabel = formatYmdLabel(dateYmd, formatDate) || dateYmd;
  const accent = isWorking ? colors.brand : colors.borderStrong;

  useEffect(() => {
    if (!open) return;
    setOvertimeEnd(currentOvertimeEnd?.trim() || defaultOvertimeEnd(defaultShiftEnd));
  }, [currentOvertimeEnd, dateYmd, defaultShiftEnd, open]);

  const ActionBtn = ({
    label,
    onPress,
    icon,
    tone = 'brand',
    filled = false,
  }: {
    label: string;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    tone?: 'brand' | 'danger' | 'neutral';
    filled?: boolean;
  }) => {
    const ink =
      filled && tone === 'brand'
        ? colors.onBrand
        : tone === 'danger'
          ? colors.error
          : tone === 'neutral'
            ? colors.textSecondary
            : colors.brand;
    const bg =
      filled && tone === 'brand'
        ? colors.brand
        : tone === 'danger'
          ? colors.errorSoft
          : colors.surfaceSecondary;
    const border =
      filled && tone === 'brand'
        ? colors.brand
        : tone === 'danger'
          ? colors.error
          : colors.border;
    return (
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
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          opacity: busy ? 0.55 : 1,
          ...(filled && tone === 'brand' && !busy
            ? colorScheme === 'dark'
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
                }
            : null),
        }}
      >
        {icon ? <Ionicons name={icon} size={18} color={ink} /> : null}
        <AppText variant="label" weight="semibold" style={{ color: ink }}>
          {label}
        </AppText>
      </AnimatedPressable>
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.dayCapacity.title', { date: dateLabel })}
      fitContent
      maxHeight={Math.round(height * 0.72)}
    >
      <View style={{ gap: theme.spacing.md }}>
        <DayCapacityCard accent={accent}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isWorking ? colors.brandSoft : colors.surfaceSecondary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              }}
            >
              <Ionicons
                name={isWorking ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={isWorking ? colors.brand : colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="heading" weight={titleWeight}>
                {t('mobile.adminScheduling.dayCapacity.workingDay')}
              </AppText>
              <AppText variant="caption" color="secondary">
                {t('mobile.adminScheduling.dayCapacity.normalShift', {
                  range: formatTimeRange(locale, defaultShiftStart, defaultShiftEnd),
                })}
              </AppText>
            </View>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: isWorking ? colors.brandSoft : colors.surfaceSecondary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isWorking ? colors.brand : colors.borderStrong,
              }}
            >
              <AppText
                variant="caption"
                weight={titleWeight}
                style={{ color: isWorking ? colors.brand : colors.textSecondary }}
              >
                {isWorking
                  ? t('mobile.adminScheduling.dayCapacity.statusOpen')
                  : t('mobile.adminScheduling.dayCapacity.statusClosed')}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color="muted" style={{ lineHeight: 18 }}>
            {t('mobile.adminScheduling.dayCapacity.body')}
          </AppText>
        </DayCapacityCard>

        {isWorking ? (
          <DayCapacityCard accent={colors.brand}>
            <OvertimeStepper
              value={overtimeEnd}
              shiftEnd={defaultShiftEnd}
              disabled={busy}
              onChange={setOvertimeEnd}
            />
          </DayCapacityCard>
        ) : null}

        {busy ? <ActivityIndicator color={colors.brand} /> : null}

        <View style={{ gap: theme.spacing.sm }}>
          {!isWorking ? (
            <ActionBtn
              label={t('mobile.adminScheduling.dayCapacity.open')}
              icon="sunny-outline"
              filled
              onPress={onOpenDay}
            />
          ) : (
            <ActionBtn
              label={t('mobile.adminScheduling.dayCapacity.addOvertime')}
              icon="time-outline"
              filled
              onPress={() => onOvertime(overtimeEnd)}
            />
          )}

          {isWorking ? (
            <ActionBtn
              label={t('mobile.adminScheduling.dayCapacity.close')}
              icon="moon-outline"
              tone="danger"
              onPress={onCloseDay}
            />
          ) : null}

          {hasException ? (
            <ActionBtn
              label={t('mobile.adminScheduling.dayCapacity.clear')}
              icon="refresh-outline"
              tone="danger"
              onPress={onClearException}
            />
          ) : null}

          {errorMessage ? (
            <AppText variant="caption" color="error">
              {errorMessage}
            </AppText>
          ) : null}

          <ActionBtn
            label={t('mobile.production.cancel')}
            tone="neutral"
            onPress={onClose}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

type ApproveAllSheetProps = {
  open: boolean;
  onClose: () => void;
  count: number;
  loading?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
};

export function ApproveAllSchedulesSheet({
  open,
  onClose,
  count,
  loading,
  errorMessage,
  onConfirm,
}: ApproveAllSheetProps) {
  const { t, tPlural } = useLocale();
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.sheets.approveAllTitle')}
      fitContent
      maxHeight={Math.round(height * 0.48)}
    >
      <View style={{ gap: theme.spacing.md }}>
        <ConfirmCopyBoard
          icon="checkmark-done-outline"
          orderNumber={String(count)}
          body={tPlural('mobile.adminScheduling.sheets.approveAllBody', count)}
          errorMessage={errorMessage}
        />
        <SheetFooter
          confirmLabel={t('mobile.adminScheduling.sheets.approveAllConfirm')}
          cancelLabel={t('mobile.production.cancel')}
          loading={loading}
          onConfirm={onConfirm}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}

type ResolveConflictSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  loading?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
};

export function ResolveConflictSheet({
  open,
  onClose,
  title,
  body,
  loading,
  errorMessage,
  onConfirm,
}: ResolveConflictSheetProps) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      fitContent
      overlay
      maxHeight={Math.round(height * 0.48)}
    >
      <View style={{ gap: theme.spacing.md }}>
        <ConfirmCopyBoard
          icon="git-compare-outline"
          orderNumber=""
          body={body}
          errorMessage={errorMessage}
        />
        <SheetFooter
          confirmLabel={t('mobile.adminScheduling.conflicts.resolveConfirm')}
          cancelLabel={t('mobile.production.cancel')}
          loading={loading}
          onConfirm={onConfirm}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}

type ReviewTask = {
  title: string;
  number: string;
  stage: string;
  window: string;
  priority?: string | null;
  delivery?: string | null;
};

type ConflictReviewSheetProps = {
  open: boolean;
  onClose: () => void;
  typeLabel: string;
  workerName: string;
  task1: ReviewTask;
  task2: ReviewTask;
  overlapWindow: string;
  overlapDuration: string;
  suggested?: string | null;
  errorMessage?: string | null;
  loading?: boolean;
  canResolve?: boolean;
  onResolve?: () => void;
  onReviewSchedule?: () => void;
};

export function ConflictReviewSheet({
  open,
  onClose,
  typeLabel,
  workerName,
  task1,
  task2,
  overlapWindow,
  overlapDuration,
  suggested,
  errorMessage,
  loading,
  canResolve,
  onResolve,
  onReviewSchedule,
}: ConflictReviewSheetProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const renderTask = (label: string, task: ReviewTask) => (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.sm + 2,
        gap: 4,
      }}
    >
      <AppText variant="caption" weight="semibold" style={{ color: colors.error, fontSize: 10 }}>
        {label}
      </AppText>
      {task.title ? (
        <AppText variant="label" weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {task.title}
        </AppText>
      ) : null}
      <AppText variant="caption" color="secondary" dir="ltr">
        {task.number}
      </AppText>
      {task.stage ? (
        <AppText variant="caption" color="muted">
          {task.stage}
        </AppText>
      ) : null}
      <AppText variant="caption" weight="semibold" dir="ltr">
        {task.window}
      </AppText>
      {task.priority ? (
        <AppText variant="caption" color="muted">
          {task.priority}
        </AppText>
      ) : null}
      {task.delivery ? (
        <AppText variant="caption" color="muted">
          {task.delivery}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={typeLabel}
      fitContent
      maxHeight={Math.round(height * 0.86)}
    >
      <View style={{ gap: theme.spacing.md }}>
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.error,
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
              backgroundColor: colors.error,
            }}
          />
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
              ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="label" weight={titleWeight} dir="auto">
              {workerName}
            </AppText>
            <AppText variant="caption" color="secondary">
              {t('mobile.adminScheduling.conflicts.twoTasksSameTime')}
            </AppText>
            {renderTask(t('mobile.adminScheduling.conflicts.taskOne'), task1)}
            {renderTask(t('mobile.adminScheduling.conflicts.taskTwo'), task2)}
            <View style={{ gap: 2 }}>
              <AppText variant="caption" weight="semibold" style={{ color: colors.error }}>
                {t('mobile.adminScheduling.conflicts.overlap')}
              </AppText>
              <AppText variant="caption" dir="ltr">
                {overlapWindow}
              </AppText>
              <AppText variant="caption" color="muted">
                {overlapDuration}
              </AppText>
            </View>
            {suggested ? (
              <View style={{ gap: 2 }}>
                <AppText variant="caption" weight="semibold">
                  {t('mobile.adminScheduling.conflicts.suggestedResolution')}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {suggested}
                </AppText>
              </View>
            ) : null}
            {errorMessage ? (
              <AppText variant="caption" style={{ color: colors.error }}>
                {errorMessage}
              </AppText>
            ) : null}
          </View>
        </View>
        {onReviewSchedule ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.adminScheduling.dates.reviewSchedule')}
            onPress={() => {
              void haptics.selection();
              onReviewSchedule();
            }}
          >
            <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
              {t('mobile.adminScheduling.dates.reviewSchedule')}
            </AppText>
          </AnimatedPressable>
        ) : null}
        {canResolve && onResolve ? (
          <SheetFooter
            confirmLabel={t('mobile.adminScheduling.conflicts.resolveConfirm')}
            cancelLabel={t('mobile.production.cancel')}
            loading={loading}
            onConfirm={onResolve}
            onCancel={onClose}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

export function ConflictHelpSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.conflicts.helpTitle')}
      fitContent
      maxHeight={Math.round(height * 0.62)}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <ConfirmCopyBoard
          icon="information-circle-outline"
          orderNumber=""
          body={t('mobile.adminScheduling.conflicts.helpBody')}
        />
        <AppText variant="caption" color="secondary">
          {t('mobile.adminScheduling.conflicts.helpConflict')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t('mobile.adminScheduling.conflicts.helpAtRisk')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t('mobile.adminScheduling.conflicts.helpFull')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t('mobile.adminScheduling.conflicts.helpPriority')}
        </AppText>
        <AppText variant="caption" color="muted">
          {t('mobile.adminScheduling.conflicts.sameDayAllowed')}
        </AppText>
      </View>
    </BottomSheet>
  );
}

export function AtRiskHelpSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminScheduling.atRisk.helpTitle')}
      fitContent
      maxHeight={Math.round(height * 0.56)}
    >
      <ConfirmCopyBoard
        icon="information-circle-outline"
        orderNumber=""
        body={t('mobile.adminScheduling.atRisk.helpBody')}
      />
    </BottomSheet>
  );
}

export function AtRiskDetailSheet({
  open,
  onClose,
  onClosed,
  orderNumber,
  productTitle,
  dealerName,
  imageUrl,
  statusLabel,
  riskStatus,
  reasonLabel,
  actionLabel,
  actionIcon,
  daysLateLabel,
  requested,
  suggested,
  committed,
  projected,
  earliestFeasible,
  stageName,
  requiredWip,
  producedBy,
  currentStage,
  missingMaterial,
  stageAtCapacity,
  requestedInfeasible,
  onAction,
  canAct,
}: {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  orderNumber: string;
  productTitle?: string | null;
  dealerName?: string | null;
  imageUrl?: string | null;
  statusLabel: string;
  riskStatus?: string | null;
  reasonLabel: string;
  actionLabel: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  daysLateLabel?: string | null;
  requested: string | null;
  suggested: string | null;
  committed: string | null;
  projected: string | null;
  earliestFeasible: string | null;
  stageName?: string | null;
  requiredWip?: string | null;
  producedBy?: string | null;
  currentStage?: string | null;
  missingMaterial?: string | null;
  stageAtCapacity?: string | null;
  requestedInfeasible?: boolean;
  onAction?: () => void;
  canAct?: boolean;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const tone = riskStatus === 'AT_RISK' ? 'risk' : riskStatus === 'BLOCKED' ? 'blocked' : 'late';
  const accent = tone === 'risk' ? colors.warning : colors.error;
  const wash = tone === 'risk' ? colors.warningSoft : colors.errorSoft;
  const statusIcon =
    riskStatus === 'LATE' ? 'time-outline' : riskStatus === 'BLOCKED' ? 'ban-outline' : 'warning-outline';
  const extras = [
    { label: t('mobile.adminScheduling.atRisk.requiredWip'), value: requiredWip },
    { label: t('mobile.adminScheduling.atRisk.producedBy'), value: producedBy },
    { label: t('mobile.adminScheduling.atRisk.currentStage'), value: currentStage ?? stageName },
    { label: t('mobile.adminScheduling.atRisk.missingMaterial'), value: missingMaterial },
    { label: t('mobile.adminScheduling.atRisk.stageAtCapacity'), value: stageAtCapacity },
    { label: t('mobile.adminScheduling.dates.earliestFeasible'), value: earliestFeasible, ltr: true },
  ].filter((row) => Boolean(row.value));
  const dates = [
    { label: t('mobile.adminScheduling.dates.requested'), value: requested },
    { label: t('mobile.adminScheduling.dates.suggested'), value: suggested },
    { label: t('mobile.adminScheduling.atRisk.promised'), value: committed },
    { label: t('mobile.adminScheduling.dates.projectedCompletion'), value: projected },
  ].filter((row) => Boolean(row.value));
  const heading = productTitle?.trim() || orderNumber;
  const maxHeight = Math.round(height * 0.78);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      title={heading}
      fitContent
      maxHeight={maxHeight}
    >
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: Math.max(220, maxHeight - 120) }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
      >
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: accent,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View style={{ height: 5, backgroundColor: wash }} />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              alignItems: 'flex-start',
            }}
          >
            <OrderCardMedia imageUrl={imageUrl ?? null} size={72} />
            <View style={{ flex: 1, minWidth: 0, gap: 6, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <AppText
                variant="caption"
                color="secondary"
                dir="ltr"
                style={{ letterSpacing: 0.4, fontVariant: ['tabular-nums'] }}
              >
                {orderNumber}
              </AppText>
              {dealerName ? (
                <AppText
                  variant="caption"
                  color="muted"
                  numberOfLines={2}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {dealerName}
                </AppText>
              ) : null}
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: theme.radius.full,
                  backgroundColor: wash,
                  borderWidth: 1,
                  borderColor: accent,
                }}
              >
                <Ionicons name={statusIcon} size={13} color={accent} />
                <AppText variant="caption" weight="semibold" style={{ color: accent }}>
                  {statusLabel}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        <View
          style={{
            borderRadius: theme.radius.xl,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left', letterSpacing: 0.3 }}
          >
            {t('mobile.adminScheduling.atRisk.promised')}
          </AppText>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
            <SheetDateTile
              label={t('mobile.adminScheduling.atRisk.promised')}
              value={committed ?? requested ?? '—'}
            />
            <SheetDateTile
              label={t('mobile.adminScheduling.dates.projectedCompletion')}
              value={projected ?? t('mobile.adminScheduling.atRisk.noProjected')}
              accent={accent}
            />
          </View>
          {daysLateLabel ? (
            <View
              style={{
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: colors.errorSoft,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.error }}>
                {daysLateLabel}
              </AppText>
            </View>
          ) : null}
          {dates.map((item, index) => (
            <SheetMetaRow key={`${item.label}-${index}`} label={item.label} value={item.value!} ltr />
          ))}
        </View>

        <View
          style={{
            borderRadius: theme.radius.xl,
            backgroundColor: wash,
            borderWidth: 1,
            borderColor: accent,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="information-circle-outline" size={16} color={accent} />
            <AppText variant="caption" weight="semibold" style={{ color: accent }}>
              {t('mobile.adminScheduling.atRisk.reason')}
            </AppText>
          </View>
          <AppText
            variant="body"
            style={{ textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }}
          >
            {requestedInfeasible
              ? t('mobile.adminScheduling.atRisk.requestedCannotBeMet')
              : reasonLabel}
          </AppText>
          {extras.map((item, index) => (
            <SheetMetaRow
              key={`${item.label}-${index}`}
              label={item.label}
              value={item.value!}
              ltr={item.ltr}
            />
          ))}
        </View>

        {canAct && onAction ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={() => {
              void haptics.selection();
              onAction();
            }}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.full,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: colors.brand,
              ...orderBoardShadow(colorScheme),
            }}
          >
            <Ionicons name={actionIcon ?? 'arrow-forward-outline'} size={18} color={colors.onBrand} />
            <AppText variant="label" weight="semibold" style={{ color: colors.onBrand }}>
              {actionLabel}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

function SheetDateTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: accent ?? colors.border,
        gap: 4,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
      }}
    >
      <AppText variant="caption" color="muted" numberOfLines={2} style={{ fontSize: 10 }}>
        {label}
      </AppText>
      <AppText
        variant="label"
        weight="semibold"
        dir="ltr"
        numberOfLines={1}
        style={{ color: accent ?? colors.textPrimary, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
    </View>
  );
}

function SheetMetaRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <AppText variant="caption" color="muted" style={{ flexShrink: 1 }}>
        {label}
      </AppText>
      <AppText variant="caption" weight="semibold" dir={ltr ? 'ltr' : 'auto'} style={{ flexShrink: 1 }}>
        {value}
      </AppText>
    </View>
  );
}

function resolveAllReasonIcon(key: string): keyof typeof Ionicons.glyphMap {
  if (key.includes('committedCannotBeMet') || key.includes('requestedCannotBeMet')) {
    return 'calendar-outline';
  }
  if (key.includes('wipNotReady') || key.includes('requiredWip')) return 'layers-outline';
  if (key.includes('materialNotReady') || key.includes('missingMaterial')) return 'cube-outline';
  if (key.includes('capacity') || key.includes('stageAtCapacity')) return 'speedometer-outline';
  if (key.includes('estimateReview') || key.includes('reviewEstimates')) return 'create-outline';
  if (key.includes('noEligibleWorker') || key.includes('manageWorkers')) return 'people-outline';
  return 'warning-outline';
}

function ResolveAllStatTile({
  label,
  value,
  accent,
  wash,
}: {
  label: string;
  value: number;
  accent: string;
  wash: string;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 12,
        borderRadius: theme.radius.lg,
        backgroundColor: wash,
        borderWidth: 1,
        borderColor: accent,
        gap: 6,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
      }}
    >
      <AppText variant="caption" color="muted" numberOfLines={2} style={{ fontSize: 10, letterSpacing: 0.3 }}>
        {label}
      </AppText>
      <AppText
        variant="title"
        weight="semibold"
        dir="ltr"
        style={{ color: accent, fontVariant: ['tabular-nums'], lineHeight: 28 }}
      >
        {value}
      </AppText>
    </View>
  );
}

function ResolveAllReasonRow({
  reasonKey,
  label,
  countLabel,
  a11yLabel,
}: {
  reasonKey: string;
  label: string;
  countLabel: string;
  a11yLabel: string;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const icon = resolveAllReasonIcon(reasonKey);
  return (
    <View
      accessible
      accessibilityLabel={a11yLabel}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.warningSoft,
        }}
      >
        <Ionicons name={icon} size={16} color={colors.warning} />
      </View>
      <AppText
        variant="caption"
        weight="semibold"
        style={{ flex: 1, textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
      >
        {label}
      </AppText>
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: theme.radius.full,
          backgroundColor: colors.warningSoft,
          borderWidth: 1,
          borderColor: colors.warning,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          dir="ltr"
          style={{ color: colors.warning, fontVariant: ['tabular-nums'] }}
        >
          {countLabel}
        </AppText>
      </View>
    </View>
  );
}

export function ResolveAllAtRiskSheet({
  open,
  onClose,
  loading,
  onConfirm,
  errorMessage,
  result,
}: {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  onConfirm?: () => void;
  errorMessage?: string | null;
  result?: {
    resolvedAutomatically: number;
    stillNeedsAttention: number;
    alreadyOnTrack: number;
    remaining: number;
    reasonGroups: Array<{ key: string; label: string; count: number }>;
  } | null;
}) {
  const { t, tPlural, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const showingResult = Boolean(result);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const needsAdmin = Boolean(result && result.stillNeedsAttention > 0);
  const accent = needsAdmin ? colors.warning : colors.success;
  const wash = needsAdmin ? colors.warningSoft : colors.successSoft;
  const maxHeight = Math.round(height * 0.74);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        showingResult
          ? t('mobile.adminScheduling.atRisk.resolveAllTitle')
          : t('mobile.adminScheduling.atRisk.resolveAll')
      }
      fitContent
      maxHeight={maxHeight}
    >
      {showingResult && result ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: Math.max(240, maxHeight - 88) }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: accent,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View style={{ height: 5, backgroundColor: wash }} />
            <View
              style={{
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
                alignItems: isRTL ? 'flex-end' : 'flex-start',
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
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: wash,
                    borderWidth: 1,
                    borderColor: accent,
                  }}
                >
                  <Ionicons
                    name={needsAdmin ? 'warning-outline' : 'checkmark-circle-outline'}
                    size={18}
                    color={accent}
                  />
                </View>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: theme.radius.full,
                    backgroundColor: wash,
                    borderWidth: 1,
                    borderColor: accent,
                  }}
                >
                  <AppText variant="caption" weight="semibold" style={{ color: accent }}>
                    {needsAdmin
                      ? t('mobile.adminScheduling.atRisk.stillNeedsAttention')
                      : t('mobile.adminScheduling.atRisk.resolveAllStatusClear')}
                  </AppText>
                </View>
              </View>
              <AppText
                variant="body"
                color="secondary"
                style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 22 }}
              >
                {needsAdmin
                  ? t('mobile.adminScheduling.atRisk.resolveAllNeedsAdmin')
                  : t('mobile.adminScheduling.atRisk.resolveAllClearBody')}
              </AppText>
            </View>
          </View>

          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
            <ResolveAllStatTile
              label={t('mobile.adminScheduling.atRisk.resolvedAutomatically')}
              value={result.resolvedAutomatically}
              accent={result.resolvedAutomatically > 0 ? colors.success : colors.textMuted}
              wash={result.resolvedAutomatically > 0 ? colors.successSoft : colors.surfaceSecondary}
            />
            <ResolveAllStatTile
              label={t('mobile.adminScheduling.atRisk.stillNeedsAttention')}
              value={result.stillNeedsAttention}
              accent={needsAdmin ? colors.warning : colors.textMuted}
              wash={needsAdmin ? colors.warningSoft : colors.surfaceSecondary}
            />
          </View>

          {result.alreadyOnTrack > 0 ? (
            <View
              style={{
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: theme.radius.full,
                backgroundColor: colors.successSoft,
                borderWidth: 1,
                borderColor: colors.success,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.success }}>
                {`${t('mobile.adminScheduling.atRisk.alreadyOnTrack')} · ${result.alreadyOnTrack}`}
              </AppText>
            </View>
          ) : null}

          {result.reasonGroups.length > 0 ? (
            <View
              style={{
                borderRadius: theme.radius.xl,
                backgroundColor: wash,
                borderWidth: 1,
                borderColor: accent,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="information-circle-outline" size={16} color={accent} />
                <AppText variant="caption" weight={titleWeight} style={{ color: accent }}>
                  {t('mobile.adminScheduling.atRisk.resolveAllReasonsTitle')}
                </AppText>
              </View>
              {result.reasonGroups.map((group) => (
                <ResolveAllReasonRow
                  key={group.key}
                  reasonKey={group.key}
                  label={group.label}
                  countLabel={tPlural('mobile.adminScheduling.atRisk.remainingCount', group.count)}
                  a11yLabel={tPlural('mobile.adminScheduling.atRisk.remainingReason', group.count, {
                    reason: group.label,
                  })}
                />
              ))}
            </View>
          ) : null}

          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.adminScheduling.atRisk.done')}
            onPress={() => {
              void haptics.selection();
              onClose();
            }}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.full,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: colors.brand,
              ...orderBoardShadow(colorScheme),
            }}
          >
            <Ionicons name="checkmark" size={18} color={colors.onBrand} />
            <AppText variant="label" weight="semibold" style={{ color: colors.onBrand }}>
              {t('mobile.adminScheduling.atRisk.done')}
            </AppText>
          </AnimatedPressable>
        </ScrollView>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <ConfirmCopyBoard
            icon="refresh-outline"
            orderNumber=""
            body={t('mobile.adminScheduling.atRisk.resolveAllBody')}
            errorMessage={errorMessage}
          />
          <SheetFooter
            confirmLabel={t('mobile.adminScheduling.atRisk.resolveAll')}
            cancelLabel={t('mobile.production.cancel')}
            loading={loading}
            onConfirm={() => onConfirm?.()}
            onCancel={onClose}
          />
        </View>
      )}
    </BottomSheet>
  );
}

function syncSheetTitle(phase: SyncScheduleSheetPhase, t: (key: string) => string): string {
  if (phase === 'syncing') return t('mobile.adminScheduling.sync.syncing');
  if (phase === 'upToDate') return t('mobile.adminScheduling.sync.upToDate');
  if (phase === 'changed') return t('mobile.adminScheduling.sync.complete');
  if (phase === 'partial') return t('mobile.adminScheduling.sync.partial');
  if (phase === 'failed') return t('mobile.adminScheduling.sync.failed');
  if (phase === 'inProgress') return t('mobile.adminScheduling.sync.inProgress');
  return t('mobile.adminScheduling.sync.confirmTitle');
}

export function SyncScheduleSheet({
  open,
  onClose,
  phase,
  stats,
  errorMessage,
  onConfirm,
  onRetry,
  onViewAttention,
}: {
  open: boolean;
  onClose: () => void;
  phase: SyncScheduleSheetPhase;
  stats?: SyncScheduleStats | null;
  errorMessage?: string | null;
  onConfirm?: () => void;
  onRetry?: () => void;
  onViewAttention?: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const showingResult = phase === 'upToDate' || phase === 'changed' || phase === 'partial' || phase === 'failed';
  const needsAdmin = phase === 'partial';
  const accent =
    phase === 'failed' ? colors.error : needsAdmin ? colors.warning : colors.success;
  const wash =
    phase === 'failed' ? colors.errorSoft : needsAdmin ? colors.warningSoft : colors.successSoft;
  const maxHeight = Math.round(height * 0.74);
  const attentionRows = [
    ...(stats?.blockedItems ?? []).map((item) => ({
      key: `blocked-${item.number}`,
      label: `${item.number} · ${t(blockerKindI18nKey(item.blockerKind))}`,
      reasonKey: blockerKindI18nKey(item.blockerKind),
    })),
    ...(stats?.manualAttentionItems ?? []).map((item) => ({
      key: `manual-${item.number}`,
      label: `${item.number} · ${t('mobile.adminScheduling.sync.manualAttention')}`,
      reasonKey: 'mobile.adminScheduling.sync.manualAttention',
    })),
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={syncSheetTitle(phase, t)}
      fitContent
      maxHeight={maxHeight}
    >
      {phase === 'syncing' ? (
        <View
          style={{
            gap: theme.spacing.md,
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
          }}
        >
          <ActivityIndicator color={colors.brand} />
          <AppText
            variant="body"
            color="secondary"
            style={{ textAlign: 'center', lineHeight: 22 }}
          >
            {t('mobile.adminScheduling.sync.syncing')}
          </AppText>
        </View>
      ) : showingResult ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: Math.max(240, maxHeight - 88) }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: accent,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View style={{ height: 5, backgroundColor: wash }} />
            <View
              style={{
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
                alignItems: isRTL ? 'flex-end' : 'flex-start',
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
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: wash,
                    borderWidth: 1,
                    borderColor: accent,
                  }}
                >
                  <Ionicons
                    name={
                      phase === 'failed'
                        ? 'alert-circle-outline'
                        : needsAdmin
                          ? 'warning-outline'
                          : 'checkmark-circle-outline'
                    }
                    size={18}
                    color={accent}
                  />
                </View>
              </View>
              <AppText
                variant="body"
                color="secondary"
                style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 22 }}
              >
                {phase === 'upToDate'
                  ? t('mobile.adminScheduling.sync.upToDateBody')
                  : phase === 'failed'
                    ? t('mobile.adminScheduling.sync.failedBody')
                    : phase === 'partial'
                      ? t('mobile.adminScheduling.sync.partial')
                      : t('mobile.adminScheduling.sync.complete')}
              </AppText>
            </View>
          </View>

          {phase !== 'upToDate' && phase !== 'failed' && stats ? (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
              <ResolveAllStatTile
                label={t('mobile.adminScheduling.sync.replanned')}
                value={stats.replanned}
                accent={stats.replanned > 0 ? colors.brand : colors.textMuted}
                wash={stats.replanned > 0 ? colors.brandSoft : colors.surfaceSecondary}
              />
              <ResolveAllStatTile
                label={t('mobile.adminScheduling.sync.generated')}
                value={stats.generated}
                accent={stats.generated > 0 ? colors.success : colors.textMuted}
                wash={stats.generated > 0 ? colors.successSoft : colors.surfaceSecondary}
              />
            </View>
          ) : null}

          {phase !== 'upToDate' && phase !== 'failed' && stats && stats.pastDueRescheduled > 0 ? (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
              <ResolveAllStatTile
                label={t('mobile.adminScheduling.sync.pastDueRescheduled')}
                value={stats.pastDueRescheduled}
                accent={colors.brand}
                wash={colors.brandSoft}
              />
            </View>
          ) : null}

          {phase !== 'failed' && stats ? (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
              <ResolveAllStatTile
                label={t('mobile.adminScheduling.sync.scanned')}
                value={stats.scanned}
                accent={colors.textMuted}
                wash={colors.surfaceSecondary}
              />
              <ResolveAllStatTile
                label={
                  phase === 'partial'
                    ? t('mobile.adminScheduling.sync.stillAttention')
                    : t('mobile.adminScheduling.sync.alreadyValid')
                }
                value={phase === 'partial' ? stats.stillAttention : stats.alreadyValid}
                accent={phase === 'partial' && stats.stillAttention > 0 ? colors.warning : colors.textMuted}
                wash={
                  phase === 'partial' && stats.stillAttention > 0
                    ? colors.warningSoft
                    : colors.surfaceSecondary
                }
              />
            </View>
          ) : null}

          {stats && (stats.atRiskRecovered > 0 || stats.conflictsResolved > 0) ? (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
              {stats.atRiskRecovered > 0 ? (
                <AppText variant="caption" weight="semibold" style={{ color: colors.success }}>
                  {`${t('mobile.adminScheduling.sync.atRiskRecovered')} · ${stats.atRiskRecovered}`}
                </AppText>
              ) : null}
              {stats.conflictsResolved > 0 ? (
                <AppText variant="caption" weight="semibold" style={{ color: colors.success }}>
                  {`${t('mobile.adminScheduling.sync.conflictsResolved')} · ${stats.conflictsResolved}`}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {needsAdmin && attentionRows.length > 0 ? (
            <View
              style={{
                borderRadius: theme.radius.xl,
                backgroundColor: wash,
                borderWidth: 1,
                borderColor: accent,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              }}
            >
              {attentionRows.slice(0, 8).map((row) => (
                <ResolveAllReasonRow
                  key={row.key}
                  reasonKey={row.reasonKey}
                  label={row.label}
                  countLabel=""
                  a11yLabel={row.label}
                />
              ))}
            </View>
          ) : null}

          {phase === 'failed' && errorMessage ? (
            <AppText variant="caption" color="error">
              {errorMessage}
            </AppText>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            {phase === 'partial' && onViewAttention ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.adminScheduling.sync.viewAttention')}
                onPress={() => {
                  void haptics.selection();
                  onViewAttention();
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderRadius: theme.radius.full,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.brand,
                }}
              >
                <AppText variant="label" weight="semibold" style={{ color: colors.brand }}>
                  {t('mobile.adminScheduling.sync.viewAttention')}
                </AppText>
              </AnimatedPressable>
            ) : null}
            {phase === 'failed' && onRetry ? (
              <SheetFooter
                confirmLabel={t('mobile.adminScheduling.sync.retry')}
                cancelLabel={t('mobile.adminScheduling.sync.done')}
                onConfirm={onRetry}
                onCancel={onClose}
              />
            ) : (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.adminScheduling.sync.done')}
                onPress={() => {
                  void haptics.selection();
                  onClose();
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderRadius: theme.radius.full,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.brand,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <Ionicons name="checkmark" size={18} color={colors.onBrand} />
                <AppText variant="label" weight="semibold" style={{ color: colors.onBrand }}>
                  {t('mobile.adminScheduling.sync.done')}
                </AppText>
              </AnimatedPressable>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <ConfirmCopyBoard
            icon="sync-outline"
            orderNumber=""
            body={
              phase === 'inProgress'
                ? t('mobile.adminScheduling.sync.inProgress')
                : t('mobile.adminScheduling.sync.confirmBody')
            }
            errorMessage={errorMessage}
          />
          {phase === 'inProgress' ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.adminScheduling.sync.done')}
              onPress={() => {
                void haptics.selection();
                onClose();
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brand,
              }}
            >
              <AppText variant="label" weight="semibold" style={{ color: colors.onBrand }}>
                {t('mobile.adminScheduling.sync.done')}
              </AppText>
            </AnimatedPressable>
          ) : (
            <SheetFooter
              confirmLabel={t('mobile.adminScheduling.sync.confirmCta')}
              cancelLabel={t('mobile.production.cancel')}
              loading={false}
              onConfirm={() => onConfirm?.()}
              onCancel={onClose}
            />
          )}
        </View>
      )}
    </BottomSheet>
  );
}

function optimizeSheetTitle(phase: OptimizeScheduleSheetPhase, t: (key: string) => string): string {
  if (phase === 'previewing') return t('mobile.adminScheduling.optimize.previewing');
  if (phase === 'preview') return t('mobile.adminScheduling.optimize.previewTitle');
  if (phase === 'applying') return t('mobile.adminScheduling.optimize.applying');
  if (phase === 'upToDate') return t('mobile.adminScheduling.optimize.upToDate');
  if (phase === 'changed') return t('mobile.adminScheduling.optimize.complete');
  if (phase === 'partial') return t('mobile.adminScheduling.optimize.partial');
  if (phase === 'failed') return t('mobile.adminScheduling.optimize.failed');
  if (phase === 'inProgress') return t('mobile.adminScheduling.optimize.inProgress');
  return t('mobile.adminScheduling.optimize.confirmTitle');
}

export function OptimizeScheduleSheet({
  open,
  onClose,
  phase,
  stats,
  errorMessage,
  onConfirm,
  onApply,
  onRetry,
  onViewAttention,
}: {
  open: boolean;
  onClose: () => void;
  phase: OptimizeScheduleSheetPhase;
  stats?: OptimizeScheduleStats | null;
  errorMessage?: string | null;
  onConfirm?: () => void;
  onApply?: () => void;
  onRetry?: () => void;
  onViewAttention?: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const busy = phase === 'previewing' || phase === 'applying';
  const showingResult =
    phase === 'upToDate' || phase === 'changed' || phase === 'partial' || phase === 'failed';
  const needsAdmin = phase === 'partial';
  const accent =
    phase === 'failed' ? colors.error : needsAdmin ? colors.warning : colors.success;
  const wash =
    phase === 'failed' ? colors.errorSoft : needsAdmin ? colors.warningSoft : colors.successSoft;
  const maxHeight = Math.round(height * 0.74);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={optimizeSheetTitle(phase, t)}
      fitContent
      maxHeight={maxHeight}
    >
      {busy ? (
        <View
          style={{
            gap: theme.spacing.md,
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
          }}
        >
          <ActivityIndicator color={colors.brand} />
          <AppText variant="body" color="secondary" style={{ textAlign: 'center', lineHeight: 22 }}>
            {phase === 'applying'
              ? t('mobile.adminScheduling.optimize.applying')
              : t('mobile.adminScheduling.optimize.previewing')}
          </AppText>
        </View>
      ) : phase === 'preview' ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: Math.max(240, maxHeight - 88) }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <AppText variant="body" color="secondary" style={{ lineHeight: 22 }}>
            {t('mobile.adminScheduling.optimize.previewBody')}
          </AppText>
          {stats ? (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
              <ResolveAllStatTile
                label={t('mobile.adminScheduling.optimize.wouldMove')}
                value={stats.wouldMove}
                accent={stats.wouldMove > 0 ? colors.brand : colors.textMuted}
                wash={stats.wouldMove > 0 ? colors.brandSoft : colors.surfaceSecondary}
              />
              <ResolveAllStatTile
                label={t('mobile.adminScheduling.optimize.scanned')}
                value={stats.scanned}
                accent={colors.textMuted}
                wash={colors.surfaceSecondary}
              />
            </View>
          ) : null}
          {stats?.previewMoves.slice(0, 6).map((move) => (
            <AppText key={move.productionOrderId} variant="caption" color="secondary">
              {`${move.number} · ${move.daysEarlier}`}
            </AppText>
          ))}
          {stats?.emptyDays.slice(0, 4).map((day) => (
            <AppText key={day.ymd} variant="caption" color="secondary">
              {`${day.ymd} · ${t(day.causeKey)}`}
            </AppText>
          ))}
          {stats && stats.wouldMove > 0 ? (
            <SheetFooter
              confirmLabel={t('mobile.adminScheduling.optimize.applyCta')}
              cancelLabel={t('mobile.adminScheduling.optimize.done')}
              onConfirm={() => onApply?.()}
              onCancel={onClose}
            />
          ) : (
            <SheetFooter
              confirmLabel={t('mobile.adminScheduling.optimize.done')}
              cancelLabel={t('mobile.adminScheduling.optimize.done')}
              onConfirm={onClose}
              onCancel={onClose}
            />
          )}
        </ScrollView>
      ) : showingResult ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: Math.max(240, maxHeight - 88) }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: accent,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View style={{ height: 5, backgroundColor: wash }} />
            <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
              <AppText variant="body" color="secondary" style={{ lineHeight: 22 }}>
                {phase === 'upToDate'
                  ? t('mobile.adminScheduling.optimize.upToDateBody')
                  : phase === 'failed'
                    ? t('mobile.adminScheduling.optimize.failedBody')
                    : phase === 'partial'
                      ? t('mobile.adminScheduling.optimize.partial')
                      : t('mobile.adminScheduling.optimize.complete')}
              </AppText>
            </View>
          </View>
          {phase !== 'upToDate' && phase !== 'failed' && stats ? (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
              <ResolveAllStatTile
                label={t('mobile.adminScheduling.optimize.moved')}
                value={stats.moved}
                accent={stats.moved > 0 ? colors.brand : colors.textMuted}
                wash={stats.moved > 0 ? colors.brandSoft : colors.surfaceSecondary}
              />
              <ResolveAllStatTile
                label={t('mobile.adminScheduling.optimize.scanned')}
                value={stats.scanned}
                accent={colors.textMuted}
                wash={colors.surfaceSecondary}
              />
            </View>
          ) : null}
          {phase === 'failed' && errorMessage ? (
            <AppText variant="caption" color="error">
              {errorMessage}
            </AppText>
          ) : null}
          {phase === 'partial' && onViewAttention ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.adminScheduling.optimize.viewAttention')}
              onPress={() => {
                void haptics.selection();
                onViewAttention();
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.brand,
              }}
            >
              <AppText variant="label" weight="semibold" style={{ color: colors.brand }}>
                {t('mobile.adminScheduling.optimize.viewAttention')}
              </AppText>
            </AnimatedPressable>
          ) : null}
          {phase === 'failed' && onRetry ? (
            <SheetFooter
              confirmLabel={t('mobile.adminScheduling.optimize.retry')}
              cancelLabel={t('mobile.adminScheduling.optimize.done')}
              onConfirm={onRetry}
              onCancel={onClose}
            />
          ) : (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              onPress={onClose}
              style={{
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brand,
              }}
            >
              <AppText variant="label" weight="semibold" style={{ color: colors.onBrand }}>
                {t('mobile.adminScheduling.optimize.done')}
              </AppText>
            </AnimatedPressable>
          )}
        </ScrollView>
      ) : phase === 'inProgress' ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="body" color="secondary">
            {t('mobile.adminScheduling.optimize.inProgress')}
          </AppText>
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            onPress={onClose}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand,
            }}
          >
            <AppText variant="label" weight="semibold" style={{ color: colors.onBrand }}>
              {t('mobile.adminScheduling.optimize.done')}
            </AppText>
          </AnimatedPressable>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="body" color="secondary" style={{ lineHeight: 22 }}>
            {t('mobile.adminScheduling.optimize.confirmBody')}
          </AppText>
          <SheetFooter
            confirmLabel={t('mobile.adminScheduling.optimize.confirmCta')}
            cancelLabel={t('mobile.production.cancel')}
            onConfirm={() => onConfirm?.()}
            onCancel={onClose}
          />
        </View>
      )}
    </BottomSheet>
  );
}
