import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { chromeSizes, useTheme } from '@/theme';

type Props = {
  accessibilityLabel: string;
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Chocolate fill (filter / primary chrome). Default is cream circle. */
  filled?: boolean;
};

/**
 * Circular home chrome — EN / sun / bell / filter.
 */
export function ChromeCircleButton({
  accessibilityLabel,
  children,
  onPress,
  disabled = false,
  size = chromeSizes.circle,
  style,
  filled = false,
}: Props) {
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        void haptics.selection();
        onPress?.();
      }}
      style={[
        {
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled
            ? disabled
              ? colors.disabledFill
              : colors.brandHover
            : disabled
              ? colors.disabledFill
              : colors.surface,
          borderWidth: filled ? 0 : 1,
          borderColor: colors.border,
          ...theme.elevation.raised,
        },
        style,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Badge seat for notification count — chocolate, not traffic red. */
export function ChromeBadge({
  count,
  isRTL,
}: {
  count: number;
  isRTL: boolean;
}) {
  const { colors } = useTheme();
  if (count <= 0) return null;
  const size = chromeSizes.badge;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 2,
        ...(isRTL ? { left: 2 } : { right: 2 }),
        minWidth: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandHover,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderWidth: 1,
        borderColor: colors.surface,
      }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        style={{ color: colors.onBrand, fontSize: 9, lineHeight: 11 }}
      >
        {count > 99 ? '99+' : String(count)}
      </AppText>
    </View>
  );
}
