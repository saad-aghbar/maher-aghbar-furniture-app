import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';
import { PressableScale } from './motion';
import { Text } from './Text';

export function Chip({
  label,
  active = false,
  onPress,
  count,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  count?: number;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      scaleTo={0.96}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text variant="caption" color={active ? 'inverse' : 'secondary'}>
        {label}
        {count != null ? ` (${count})` : ''}
      </Text>
    </PressableScale>
  );
}

/** Horizontally scrollable filter bar. */
export function ChipGroup({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.group}
    >
      <View style={styles.groupInner}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 38,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  group: { paddingVertical: 2 },
  groupInner: { flexDirection: 'row', gap: spacing.sm },
});
