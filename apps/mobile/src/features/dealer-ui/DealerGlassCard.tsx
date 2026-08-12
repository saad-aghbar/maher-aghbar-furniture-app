import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Stronger fill for metric tiles */
  intensity?: 'soft' | 'solid';
  /**
   * When false, skip elevation (use when a non-transformed parent owns the shadow —
   * press `transform` on a parent clips descendant shadows on iOS).
   */
  elevated?: boolean;
};

/**
 * Shared Apple-glass surface — frosted fill + rim.
 * Shadow lives on an outer shell so `overflow: hidden` does not clip it (iOS).
 */
export function DealerGlassCard({
  children,
  style,
  contentStyle,
  intensity = 'soft',
  elevated = true,
}: Props) {
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const wash =
    intensity === 'solid'
      ? dark
        ? 'rgba(42,36,37,0.72)'
        : 'rgba(255,255,255,0.82)'
      : dark
        ? 'rgba(42,36,37,0.48)'
        : 'rgba(255,255,255,0.58)';
  const border = dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.12)';

  // iOS skips shadows on fully transparent views — shell needs an opaque fill.
  const shellFill = colors.surface;
  const lift = elevated
    ? {
        ...theme.elevation.card,
        shadowOpacity: dark ? 0.55 : 0.2,
        shadowRadius: dark ? 22 : 18,
        shadowOffset: { width: 0, height: dark ? 12 : 10 },
        elevation: Platform.OS === 'android' ? 10 : Math.max(theme.elevation.card.elevation, 6),
      }
    : theme.elevation.none;

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.xl,
          // Lifted shell — do not set overflow:hidden here or iOS eats the shadow.
          backgroundColor: shellFill,
          ...lift,
        },
        style,
      ]}
    >
      <View
        style={{
          borderRadius: theme.radius.xl,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: border,
          backgroundColor: Platform.OS === 'android' ? colors.surface : 'transparent',
        }}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={dark ? 34 : 48}
            tint={dark ? 'dark' : 'light'}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: Platform.OS === 'android' ? colors.surface : wash },
          ]}
        />
        <View style={[{ padding: theme.spacing.lg }, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}
