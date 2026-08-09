import { View, type StyleProp, type ViewStyle } from 'react-native';
import { BrandMark } from '@/components/BrandMark';
import { useTheme } from '@/theme';

type DividerProps = {
  style?: StyleProp<ViewStyle>;
  /** Tighter vertical padding for in-board rules. */
  compact?: boolean;
};

/**
 * Soft brand rule — lines with a centered monogram (More hub separator).
 */
export function Divider({ style, compact = false }: DividerProps) {
  const { colors, theme } = useTheme();
  const markH = compact ? 14 : 18;
  const markW = compact ? 16 : 20;

  return (
    <View
      accessibilityRole="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: compact ? theme.spacing.xs : theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          alignSelf: 'stretch',
        },
        style,
      ]}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.borderStrong, opacity: 0.7 }} />
      <BrandMark variant="monogram" size="md" style={{ height: markH, width: markW }} />
      <View style={{ flex: 1, height: 1, backgroundColor: colors.borderStrong, opacity: 0.7 }} />
    </View>
  );
}
