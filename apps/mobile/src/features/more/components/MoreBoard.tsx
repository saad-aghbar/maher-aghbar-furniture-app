import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** Accent strip color — defaults to brand. */
  accent?: string;
  accentOpacity?: number;
  style?: StyleProp<ViewStyle>;
};

/** Shared floor board — parchment surface, strong border, soft elevation, accent strip. */
export function MoreBoard({
  children,
  accent,
  accentOpacity = 0.55,
  style,
}: Props) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...theme.elevation.card,
        },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent ?? colors.brand,
          opacity: accentOpacity,
        }}
      />
      {children}
    </View>
  );
}
