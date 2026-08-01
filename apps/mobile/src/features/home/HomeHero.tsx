import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AuthUser } from '@maher/types';
import { colors, radius, spacing } from '../../theme/tokens';
import { initials } from '../../lib/format';
import { Text } from '../../ui/Text';

/** Branded greeting band at the top of the home screen. */
export function HomeHero({
  user,
  greeting,
  personaLabel,
}: {
  user: AuthUser;
  greeting: string;
  personaLabel: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text variant="heading" color="inverse" latin>
            {initials(user.name)}
          </Text>
        </View>
        <View style={styles.text}>
          <Text variant="caption" style={styles.muted}>
            {greeting}
          </Text>
          <Text variant="title" color="inverse" numberOfLines={1}>
            {user.name}
          </Text>
          <View style={styles.pill}>
            <Text variant="micro" color="inverse">
              {personaLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  muted: { color: 'rgba(255,255,255,0.85)' },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});
