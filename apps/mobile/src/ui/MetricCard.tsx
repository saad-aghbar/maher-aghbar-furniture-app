import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadow, spacing, toneColor, type Tone } from '../theme/tokens';
import { Text } from './Text';

export function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  onPress,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  onPress?: () => void;
}) {
  const palette = toneColor[tone];
  const body = (
    <>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: palette.bg }]}>{icon}</View>
      </View>
      {/* Numbers stay Western digits — no locale digit conversion. */}
      <Text variant="title" latin style={styles.value}>
        {value}
      </Text>
      <Text variant="caption" color="secondary" numberOfLines={2}>
        {label}
      </Text>
      {hint ? (
        <Text variant="micro" style={{ color: palette.fg, marginTop: 2 }}>
          {hint}
        </Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View style={styles.card} accessibilityLabel={`${label}: ${value}`}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
    ...(shadow.card as object),
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { marginBottom: 2 },
});
