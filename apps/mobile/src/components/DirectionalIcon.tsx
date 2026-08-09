import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useLocale } from '@/i18n/useLocale';
import { mirrorStyle } from '@/i18n/rtl';
import { useTheme } from '@/theme';

type DirectionalIconProps = {
  children: ReactNode;
  /** When true, flip horizontally in RTL (chevrons, back arrows). */
  mirror?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function DirectionalIcon({ children, mirror = true, style }: DirectionalIconProps) {
  const { isRTL } = useLocale();
  return <View style={[mirror ? mirrorStyle(isRTL) : undefined, style]}>{children}</View>;
}

/** Simple chevron glyph used for back / forward demos. */
export function ChevronGlyph({ size = 22 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size * 0.45,
        height: size * 0.45,
        borderLeftWidth: 2.5,
        borderBottomWidth: 2.5,
        borderColor: colors.textPrimary,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}
