import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type Props = {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Layout-matching placeholder for dealer commerce surfaces. */
export function DealerSkeleton({ height = 16, width = '100%', radius, style }: Props) {
  const { colors, theme } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          width,
          borderRadius: radius ?? theme.radius.md,
          backgroundColor: colors.surfaceSecondary,
        },
        style,
      ]}
    />
  );
}
