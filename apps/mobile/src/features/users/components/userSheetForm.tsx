import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export function UserFormSection({
  icon,
  label,
  titleWeight,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  titleWeight: 'medium' | 'semibold';
  children: ReactNode;
}) {
  const { isRTL, locale } = useLocale();
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
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
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
            textAlign: isRTL ? 'right' : 'left',
            letterSpacing: locale === 'ar' ? 0 : 0.55,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            color: colors.brand,
          }}
        >
          {label}
        </AppText>
      </View>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>{children}</View>
    </View>
  );
}

export function UserFormChip({
  label,
  active,
  onPress,
  disabled = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, theme, colorScheme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min - 4,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: disabled
          ? colors.border
          : active
            ? colors.brand
            : colors.borderStrong,
        backgroundColor: disabled
          ? colors.disabledFill
          : active
            ? colors.brandSoft
            : colors.surfaceSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.55 : 1,
        ...(active && !disabled ? orderBoardShadow(colorScheme) : null),
      }}
    >
      <AppText
        variant="caption"
        weight={active && !disabled ? 'semibold' : 'medium'}
        color={disabled ? 'muted' : active ? 'brand' : 'secondary'}
        numberOfLines={1}
        align="center"
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

export function UserFormError({ message }: { message: string }) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.error,
        backgroundColor: colors.errorSoft,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AppText
        variant="caption"
        style={{ color: colors.error, textAlign: isRTL ? 'right' : 'left' }}
      >
        {message}
      </AppText>
    </View>
  );
}

export function UserFormFooter({
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
  disabled,
  compact,
}: {
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Less top padding — for short sheets where the footer sits under one card. */
  compact?: boolean;
}) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        paddingTop: compact ? theme.spacing.sm : theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      <PrimaryButton
        label={confirmLabel}
        onPress={onConfirm}
        loading={loading}
        disabled={disabled}
        style={{
          borderRadius: theme.radius.full,
          minHeight: theme.sizes.touch.min,
          paddingVertical: 0,
        }}
      />
      <SecondaryButton
        label={t('common.cancel')}
        onPress={onCancel}
        style={{
          borderRadius: theme.radius.full,
          minHeight: theme.sizes.touch.min,
          paddingVertical: 0,
        }}
      />
    </View>
  );
}

export function UserActiveToggle({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={() => {
        void haptics.selection();
        onChange(!active);
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.sizes.touch.min,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: active ? colors.brand : colors.borderStrong,
          backgroundColor: active ? colors.brand : colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active ? <Ionicons name="checkmark" size={14} color={colors.onBrand} /> : null}
      </View>
      <AppText variant="label" weight="medium" style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
        {t('users.active')}
      </AppText>
    </AnimatedPressable>
  );
}
