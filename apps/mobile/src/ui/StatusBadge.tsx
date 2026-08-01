import { StyleSheet, View } from 'react-native';
import { useI18n } from '../providers/i18n-provider';
import { radius, spacing, statusTone, toneColor, type Tone } from '../theme/tokens';
import { Text } from './Text';

/** Humanises an enum when no translation exists, e.g. READY_FOR_DELIVERY. */
function humanise(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .join(' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusBadge({ status, tone }: { status: string; tone?: Tone }) {
  const { t } = useI18n();
  const resolved = tone ?? statusTone(status);
  const palette = toneColor[resolved];
  const label = t(`statuses.${status}`, humanise(status));

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text variant="micro" style={{ color: palette.fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
