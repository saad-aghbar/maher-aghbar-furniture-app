import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { clampOrderQuantity } from '../newOrderProductKind';

type Props = {
  value: string;
  onChange: (next: string) => void;
  error?: string;
  disabled?: boolean;
};

export function NewOrderQtyStepper({ value, onChange, error, disabled }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const qty = clampOrderQuantity(value);

  const bump = (delta: number) => {
    if (disabled) return;
    void haptics.selection();
    onChange(String(clampOrderQuantity(qty + delta)));
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="label" color="secondary">
        {t('mobile.newOrder.quantity')}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: error
            ? colors.error
            : dark
              ? 'rgba(255,255,255,0.16)'
              : 'rgba(63,52,44,0.12)',
          borderRadius: theme.radius.xl,
          backgroundColor: dark ? 'rgba(255,255,255,0.08)' : colors.surface,
          overflow: 'hidden',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Pressable
          onPress={() => bump(-1)}
          disabled={disabled || qty <= 1}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.newOrder.qtyDecrease')}
          style={{
            minWidth: theme.sizes.touch.min,
            minHeight: theme.sizes.touch.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: qty <= 1 ? 0.35 : 1,
          }}
        >
          <AppText variant="title" weight="semibold">
            −
          </AppText>
        </Pressable>
        <View
          style={{
            minWidth: 48,
            paddingHorizontal: theme.spacing.sm,
            alignItems: 'center',
            borderLeftWidth: StyleSheet.hairlineWidth * 2,
            borderRightWidth: StyleSheet.hairlineWidth * 2,
            borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(63,52,44,0.1)',
          }}
        >
          <AppText variant="title" weight="semibold" dir="ltr">
            {qty}
          </AppText>
        </View>
        <AnimatedPressable
          variant="button"
          onPress={() => bump(1)}
          disabled={disabled || qty >= 99}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.newOrder.qtyIncrease')}
          style={{
            minWidth: theme.sizes.touch.min,
            minHeight: theme.sizes.touch.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: qty >= 99 ? 0.35 : 1,
          }}
        >
          <AppText variant="title" weight="semibold">
            +
          </AppText>
        </AnimatedPressable>
      </View>
      {error ? (
        <AppText variant="caption" color="error">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
