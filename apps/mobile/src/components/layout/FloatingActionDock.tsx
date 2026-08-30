import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { createElevation } from '@/theme/elevation';
import { useTheme } from '@/theme';
import { stickyCtaBottomInset } from './stickyCtaInset';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * When true: transparent outer wrapper — only the child CTA surface is opaque.
   * Does not swallow touches outside the CTA.
   */
  floating?: boolean;
  /** Override tab-bar clearance (e.g. dealer FAB clearance). */
  tabClearance?: number;
};

/**
 * Absolute bottom dock for primary CTAs — safe-area + tab clearance padding.
 * Floating mode: transparent wrapper + pointerEvents box-none; opaque child owns the surface.
 */
export function FloatingActionDock({
  children,
  style,
  floating = false,
  tabClearance = SURFACE_TAB_BAR_CLEARANCE,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, theme, colorScheme } = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: stickyCtaBottomInset(
            insets.bottom,
            theme.spacing.md,
            tabClearance,
          ),
          backgroundColor: floating ? 'transparent' : colors.background,
        },
        style,
      ]}
    >
      <View
        pointerEvents="auto"
        style={
          floating
            ? undefined
            : {
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                padding: theme.spacing.md,
                ...createElevation(colorScheme).card,
              }
        }
      >
        {children}
      </View>
    </View>
  );
}
