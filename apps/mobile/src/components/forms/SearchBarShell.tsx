import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

/** Soft lift for search pills — gentle, not a hard drop shadow. */
export function searchBarShadow(dark: boolean) {
  return dark
    ? {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 2,
      }
    : {
        shadowColor: '#1E1A1B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      };
}

type ShellProps = {
  children: ReactNode;
  error?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Hide the leading search bubble (rare). */
  hideIcon?: boolean;
  /** Defaults to brand; dealer search uses muted taupe. */
  iconColor?: string;
  /** Defaults to surface; dealer search uses a lighter cream bubble. */
  iconBubbleColor?: string;
};

/**
 * Shared search aesthetic — full pill, soft border, icon in a light circle bubble.
 * Wrap any TextInput / pressable placeholder with this for app-wide consistency.
 */
export function SearchBarShell({
  children,
  error,
  style,
  hideIcon = false,
  iconColor,
  iconBubbleColor,
}: ShellProps) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL } = useLocale();
  const dark = colorScheme === 'dark';

  return (
    <View
      style={[
        {
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
          ...searchBarShadow(dark),
        },
        style,
      ]}
    >
      {hideIcon ? null : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconBubbleColor ?? colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="search-outline" size={16} color={iconColor ?? colors.brand} />
        </View>
      )}
      {children}
    </View>
  );
}
