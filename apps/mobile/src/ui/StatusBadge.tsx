import { StyleSheet, View } from 'react-native';
import { humaniseEnum } from '../lib/format';
import { useI18n } from '../providers/i18n-provider';
import { radius, spacing, statusTone, toneColor, type Tone } from '../theme/tokens';
import { Text } from './Text';

export function StatusBadge({ status, tone }: { status: string; tone?: Tone }) {
  const { t } = useI18n();
  const resolved = tone ?? statusTone(status);
  const palette = toneColor[resolved];
  const label = t(`statuses.${status}`, humaniseEnum(status));

  // Static on purpose — badges sit inside list rows, where any entrance reads as flicker.
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
