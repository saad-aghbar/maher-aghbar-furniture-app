import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

/**
 * DEVELOPMENT row above Sign out — `__DEV__` only. Premium, not a red debug button.
 */
export function DevTestsEntryRow() {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  const router = useRouter();

  if (!__DEV__) return null;

  return (
    <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
      <AppText variant="caption" color="secondary" weight="medium">
        DEVELOPMENT
      </AppText>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Dev tests"
        testID="dev-tests-entry"
        onPress={() => {
          void haptics.selection();
          router.push('/dev/tests' as Href);
        }}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.xl,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
          }}
        >
          <Ionicons name="construct-outline" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label" weight="semibold">
            Dev tests
          </AppText>
          <AppText variant="caption" color="secondary">
            Frontend components & interaction lab
          </AppText>
        </View>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </AnimatedPressable>
    </View>
  );
}
