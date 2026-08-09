import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useTheme } from '@/theme';

type AppScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  /** Extra padding beyond safe area. Default `lg`. */
  padding?: keyof ReturnType<typeof useTheme>['theme']['spacing'];
  style?: StyleProp<ViewStyle>;
  edges?: { top?: boolean; bottom?: boolean };
  /** When set, shows the brand return stamp with a safe fallback. */
  backFallback?: Href;
};

/**
 * Full-bleed screen shell (Home-like).
 * Do not pad the shell for the floating tab bar — that creates an opaque strip
 * behind the pill. Put `SURFACE_TAB_BAR_CLEARANCE` on scroll/list content instead
 * so page content can show through under the bar.
 */
export function AppScreen({
  children,
  header,
  padding = 'lg',
  style,
  edges = { top: true, bottom: false },
  backFallback,
}: AppScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const pad = theme.spacing[padding];

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: edges.top ? insets.top + pad : pad,
          // No tab-bar clearance on the shell — content draws under the floating pill.
          paddingBottom: edges.bottom ? insets.bottom + pad : 0,
          paddingHorizontal: pad,
          gap: theme.spacing.md,
        },
        style,
      ]}
    >
      {backFallback ? <ScreenBackLead fallback={backFallback} /> : null}
      {header}
      {children}
    </View>
  );
}
