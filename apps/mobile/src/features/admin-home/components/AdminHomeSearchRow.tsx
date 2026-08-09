import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  enterDelay?: number;
};

export function AdminHomeSearchRow({ enterDelay = 160 }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(enterDelay).springify().damping(18) };

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.lg,
        alignItems: 'center',
      }}
    >
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={t('mobile.adminHome.searchPlaceholder')}
        onPress={() => {
          void haptics.selection();
          router.push('/(app)/search' as Href);
        }}
        style={{ flex: 1 }}
      >
        <SearchBarShell>
          <AppText variant="body" color="muted" style={{ flex: 1 }} numberOfLines={1}>
            {t('mobile.adminHome.searchPlaceholder')}
          </AppText>
        </SearchBarShell>
      </Pressable>
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
    </Wrapper>
  );
}
