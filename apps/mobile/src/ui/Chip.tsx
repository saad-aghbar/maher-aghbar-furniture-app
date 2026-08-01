import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text variant="caption" color={active ? 'inverse' : 'secondary'}>
        {label}
        {count != null ? ` (${count})` : ''}
      </Text>
    </Pressable>
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
  pressed: { opacity: 0.85 },
  group: { paddingVertical: 2 },
  groupInner: { flexDirection: 'row', gap: spacing.sm },
});
