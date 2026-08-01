import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, MIN_TOUCH, radius, spacing } from '../theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const spinnerColor = variant === 'primary' || variant === 'danger' ? '#fff' : colors.brand;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            variant={size === 'sm' ? 'caption' : 'subheading'}
            color={textColor(variant)}
            style={styles.label}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function textColor(variant: Variant) {
  if (variant === 'primary' || variant === 'danger') return 'inverse' as const;
  if (variant === 'secondary' || variant === 'subtle') return 'brand' as const;
  return 'secondary' as const;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { textAlign: 'center' },
  sizeMd: { minHeight: MIN_TOUCH, paddingHorizontal: spacing.md, paddingVertical: 12 },
  sizeSm: { minHeight: 38, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  fullWidth: { alignSelf: 'stretch' },
  primary: { backgroundColor: colors.brand, borderColor: colors.brand },
  danger: { backgroundColor: colors.error, borderColor: colors.error },
  secondary: { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
  subtle: { backgroundColor: colors.surface, borderColor: colors.brand },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
});
