import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { SearchActionRow } from '@/components/layout/SearchActionRow';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  enterDelay?: number;
};

export function AdminHomeSearchRow({ enterDelay = 160 }: Props) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  const row = (
    <SearchActionRow
      style={{ marginBottom: theme.spacing.lg }}
      trailing={
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.adminHome.filterA11y')}
          onPress={() => {
            void haptics.selection();
            router.push('/(app)/(admin)/(tabs)/orders' as Href);
          }}
          style={{
            width: theme.sizes.touch.min,
            height: theme.sizes.touch.min,
            borderRadius: theme.sizes.touch.min / 2,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.elevation.raised,
          }}
        >
          <Ionicons name="options-outline" size={20} color={colors.onBrand} />
        </AnimatedPressable>
      }
    >
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={t('mobile.adminHome.searchPlaceholder')}
        onPress={() => {
          void haptics.selection();
          router.push('/(app)/search' as Href);
        }}
      >
        <SearchBarShell>
          <AppText variant="body" color="muted" style={{ flex: 1 }} numberOfLines={1}>
            {t('mobile.adminHome.searchPlaceholder')}
          </AppText>
        </SearchBarShell>
      </Pressable>
    </SearchActionRow>
  );

  if (reduce) return row;
  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).springify().damping(18)}>
      {row}
    </Animated.View>
  );
}
