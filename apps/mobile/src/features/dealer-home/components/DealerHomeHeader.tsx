import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BrandMark } from '@/components/BrandMark';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type DealerHomeHeaderProps = {
  unreadNotifications: number;
  canOpenNotifications: boolean;
};

/** Monogram + lang / theme / notifications (notifications flush to the edge). */
export function DealerHomeHeader({
  unreadNotifications,
  canOpenNotifications,
}: DealerHomeHeaderProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const dark = colorScheme === 'dark';
  const chromeBg = dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.55)';
  const chromeBorder = dark ? 'rgba(255,255,255,0.16)' : 'rgba(63,52,44,0.12)';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.sm,
      }}
    >
      <BrandMark
        variant="monogram"
        tone={dark ? 'on-dark' : 'on-light'}
        size="lg"
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <ExpandableLocaleSwitcher expandToward="end" />
        <ThemeSwitcher
          size={40}
          backgroundColor={chromeBg}
          borderColor={chromeBorder}
          iconColor={colors.brand}
        />
        {canOpenNotifications ? (
          <View>
            <AnimatedPressable
              onPress={() => {
                void haptics.selection();
                router.push('/(app)/notifications' as Href);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.dealerHome.notificationsA11y')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: chromeBg,
                borderWidth: 1,
                borderColor: chromeBorder,
              }}
            >
              <Ionicons name="notifications-outline" size={18} color={colors.brand} />
            </AnimatedPressable>
            {unreadNotifications > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  ...(isRTL ? { left: -2 } : { right: -2 }),
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.error,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                  borderWidth: 1,
                  borderColor: colors.surface,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: colors.onBrand, fontSize: 10, lineHeight: 12 }}
                >
                  {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
