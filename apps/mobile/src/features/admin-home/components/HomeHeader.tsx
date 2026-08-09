import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type HomeHeaderProps = {
  userName: string;
  unreadNotifications: number;
  canOpenNotifications: boolean;
};

function greetingPeriod(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function HomeHeader({
  userName,
  unreadNotifications,
  canOpenNotifications,
}: HomeHeaderProps) {
  const { t, formatDate, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const period = greetingPeriod(new Date().getHours());

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.duration(480).springify().damping(17) };

  return (
    <Wrapper {...wrapperProps} style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          zIndex: 30,
        }}
      >
        <AppText variant="caption" weight="medium" color="secondary" style={{ flex: 1 }}>
          {formatDate(new Date())}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <ExpandableLocaleSwitcher expandToward="end" />
          <ThemeSwitcher />
          {canOpenNotifications ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mobile.adminHome.notificationsA11y')}
              onPress={() => {
                void haptics.selection();
                router.push('/(app)/notifications' as Href);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.elevation.raised,
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.brand} />
              {unreadNotifications > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    ...(isRTL ? { left: 4 } : { right: 4 }),
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: colors.error,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{ color: colors.onBrand, fontSize: 9, lineHeight: 11 }}
                  >
                    {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="largeTitle" numberOfLines={2}>
          {t(`mobile.adminHome.greeting.${period}`, { name: userName.split(' ')[0] ?? userName })}
        </AppText>
        <AppText variant="bodySecondary" color="secondary">
          {t('mobile.adminHome.atelierSubtitle')}
        </AppText>
      </View>
    </Wrapper>
  );
}
