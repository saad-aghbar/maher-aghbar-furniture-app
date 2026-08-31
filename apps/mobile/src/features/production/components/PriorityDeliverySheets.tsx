import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { InlineDateCalendar } from '@/components/calendar';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionPriority } from '../api';

const PRIORITIES: ProductionPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const PRIORITY_ICON: Record<
  ProductionPriority,
  keyof typeof Ionicons.glyphMap
> = {
  LOW: 'arrow-down-outline',
  NORMAL: 'remove-outline',
  HIGH: 'arrow-up-outline',
  URGENT: 'flash-outline',
};

function SheetFooterActions({
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
            <AppText
              variant="label"
              weight="semibold"
              style={{ color: colors.onBrand }}
            >
              {confirmLabel}
            </AppText>
            <Ionicons name="checkmark" size={18} color={colors.onBrand} />
          </>
        )}
      </AnimatedPressable>
    </View>
  );
}

type PrioritySheetProps = {
  open: boolean;
  onClose: () => void;
  current: string;
  loading?: boolean;
  onSubmit: (priority: ProductionPriority) => void;
};

export function PrioritySheet({
  open,
  onClose,
  current,
  loading,
  onSubmit,
}: PrioritySheetProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const [selected, setSelected] = useState<ProductionPriority>(
    (current as ProductionPriority) || 'NORMAL',
  );

  useEffect(() => {
    if (open) {
      setSelected((current as ProductionPriority) || 'NORMAL');
    }
  }, [open, current]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.production.changePriority')}
      sheetHeight={440}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
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
          {PRIORITIES.map((p, index) => {
            const active = p === selected;
            const key = `mobile.production.priority.${p}`;
            const label = t(key);
            const tint =
              p === 'URGENT'
                ? colors.error
                : p === 'HIGH'
                  ? colors.warning
                  : p === 'LOW'
                    ? colors.textMuted
                    : colors.brand;
            const soft =
              p === 'URGENT'
                ? colors.errorSoft
                : p === 'HIGH'
                  ? colors.warningSoft
                  : p === 'LOW'
                    ? colors.surface
                    : colors.brandSoft;
            const last = index === PRIORITIES.length - 1;
            return (
              <View key={p}>
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label === key ? p : label}
                  onPress={() => {
                    void haptics.selection();
                    setSelected(p);
                  }}
                  style={{
                    minHeight: theme.sizes.touch.min,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm + 2,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    backgroundColor: active ? colors.surface : 'transparent',
                  }}
                >
                  {active ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 8,
                        bottom: 8,
                        ...(isRTL ? { right: 0 } : { left: 0 }),
                        width: 3,
                        borderRadius: 2,
                        backgroundColor: tint,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? soft : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? tint : colors.border,
                    }}
                  >
                    <Ionicons name={PRIORITY_ICON[p]} size={18} color={tint} />
                  </View>
                  <AppText
                    variant="label"
                    weight={
                      active
                        ? locale === 'ar'
                          ? 'medium'
                          : 'semibold'
                        : 'medium'
                    }
                    style={{ flex: 1, color: active ? tint : colors.textPrimary }}
                  >
                    {label === key ? p : label}
                  </AppText>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={22} color={tint} />
                  ) : (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 1.5,
                        borderColor: colors.borderStrong,
                      }}
                    />
                  )}
                </AnimatedPressable>
                {!last ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.border,
                      marginLeft: isRTL ? theme.spacing.md : 60,
                      marginRight: isRTL ? 60 : theme.spacing.md,
                    }}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <SheetFooterActions
          confirmLabel={t('mobile.production.confirm')}
          cancelLabel={t('mobile.production.cancel')}
          loading={loading}
          onConfirm={() => onSubmit(selected)}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}

type DeliveryDateSheetProps = {
  open: boolean;
  onClose: () => void;
  current?: string | null;
  loading?: boolean;
  onSubmit: (isoDate: string) => void;
};

export function DeliveryDateSheet({
  open,
  onClose,
  current,
  loading,
  onSubmit,
}: DeliveryDateSheetProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const initial = current ? current.slice(0, 10) : '';
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(current ? current.slice(0, 10) : '');
      setError(null);
    }
  }, [open, current]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.production.changeDelivery')}
      fitContent
    >
      <View style={{ gap: theme.spacing.md }}>
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
            overflow: 'hidden',
          }}
        >
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
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
              }}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.brand} />
            </View>
            <AppText variant="caption" color="muted" style={{ flex: 1 }}>
              {t('mobile.production.deliveryDate')}
            </AppText>
          </View>
          <InlineDateCalendar value={value} onSelect={setValue} resetKey={open} />
          {error ? (
            <AppText variant="caption" color="error">
              {error}
            </AppText>
          ) : null}
        </View>

        <SheetFooterActions
          confirmLabel={t('mobile.production.confirm')}
          cancelLabel={t('mobile.production.cancel')}
          loading={loading}
          onConfirm={() => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
              setError(t('mobile.production.deliveryDateInvalid'));
              return;
            }
            setError(null);
            onSubmit(`${value.trim()}T12:00:00.000Z`);
          }}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}
