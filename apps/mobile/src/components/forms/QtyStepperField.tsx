import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { bumpQtyValue, parseQty, sanitizeQtyInput } from '@/components/forms/qtyStepper';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';

type Props = {
  label?: string;
  value: string;
  onChangeText: (next: string) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function QtyStepperField({
  label,
  value,
  onChangeText,
  min = 0,
  max,
  step = 1,
  decimals = 2,
  error,
  disabled,
  placeholder = '0',
  accessibilityLabel,
  containerStyle,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const n = parseQty(value);
  const atMin = n == null ? min <= 0 : n <= min;
  const atMax = max != null && n != null && n >= max;
  const a11y = accessibilityLabel ?? label ?? t('mobile.inventory.qtyPlaceholder');

  const bump = (delta: number) => {
    if (disabled) return;
    void haptics.selection();
    onChangeText(bumpQtyValue(value, delta, { min, max, decimals, step }));
  };

  return (
    <View style={[{ gap: theme.spacing.xs, width: '100%' }, containerStyle]}>
      {label ? (
        <AppText variant="label" color="secondary">
          {label}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          opacity: disabled ? 0.55 : 1,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <AnimatedPressable
          variant="button"
          disabled={disabled || atMin}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.inventory.qtyDecrease')}
          onPress={() => bump(-step)}
          style={{
            minWidth: theme.sizes.touch.min,
            minHeight: theme.sizes.touch.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: atMin ? 0.35 : 1,
          }}
        >
          <AppText variant="title" weight="semibold">
            −
          </AppText>
        </AnimatedPressable>
        <View
          style={{
            flex: 1,
            minWidth: 56,
            alignItems: 'center',
            justifyContent: 'center',
            borderLeftWidth: StyleSheet.hairlineWidth * 2,
            borderRightWidth: StyleSheet.hairlineWidth * 2,
            borderColor: colors.border,
          }}
        >
          <AppTextInput
            value={value}
            onChangeText={(text) => onChangeText(sanitizeQtyInput(text))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            selectTextOnFocus
            editable={!disabled}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={a11y}
            returnKeyType="done"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={12}
            style={{
              width: '100%',
              minHeight: theme.sizes.touch.min,
              paddingHorizontal: theme.spacing.sm,
              textAlign: 'center',
              color: colors.textPrimary,
              fontSize: 16,
              ...resolveAppFontStyle(locale, { variant: 'body', weight: 'semibold' }),
            }}
          />
        </View>
        <AnimatedPressable
          variant="button"
          disabled={disabled || atMax}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.inventory.qtyIncrease')}
          onPress={() => bump(step)}
          style={{
            minWidth: theme.sizes.touch.min,
            minHeight: theme.sizes.touch.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: atMax ? 0.35 : 1,
          }}
        >
          <AppText variant="title" weight="semibold">
            +
          </AppText>
        </AnimatedPressable>
      </View>
      {error ? (
        <AppText
          variant="caption"
          color="error"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
