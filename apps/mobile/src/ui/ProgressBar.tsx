import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme/tokens';

export function ProgressBar({
  percent,
  tone = colors.brand,
  height = 8,
}: {
  percent: number;
  tone?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={[styles.track, { height }]}
    >
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: tone }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
