import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { searchBarShadow } from '@/components/forms/SearchBarShell';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  enterDelay?: number;
};

/**
 * Admin Home search + filter — cream paper pill + wood-brown icon,
 * matching the filter chip (not the cool UIKit search look).
 */
export function AdminHomeSearchRow({ enterDelay = 160 }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';

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
        <View
          style={{
            minHeight: theme.sizes.touch.min,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: dark ? colors.borderStrong : colors.border,
            backgroundColor: colors.surface,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
            ...searchBarShadow(dark),
          }}
        >
          <Ionicons name="search-outline" size={18} color={colors.brand} />
          <AppText variant="body" color="muted" style={{ flex: 1 }} numberOfLines={1}>
            {t('mobile.adminHome.searchPlaceholder')}
          </AppText>
        </View>
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
