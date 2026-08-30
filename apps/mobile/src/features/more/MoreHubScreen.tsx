import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { Divider } from '@/components/layout/Divider';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useNotificationsQuery } from '@/features/notifications/query';
import { normalizeNotificationList, unreadCount } from '@/features/notifications/selectNotification';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { MoreFloorCommand } from './components/MoreFloorCommand';
import { MoreIdentityBoard } from './components/MoreIdentityBoard';
import { MorePreferencesBoard } from './components/MorePreferencesBoard';

/** Admin More hub — signed in, prefs, places, automation. */
export function MoreHubScreen() {
  const { user, logout } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const reduce = useReducedMotion();
  /** Same scroll pad as Orders / other tab screens so the last Places card clears the pill. */
  const scrollBottomPad =
    insets.bottom + theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE + theme.spacing['5xl'];
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canNotify = can(user, 'notification.read');
  const notificationsQuery = useNotificationsQuery(Boolean(user) && canNotify);
  const unread = unreadCount(normalizeNotificationList(notificationsQuery.data));

  if (!user) return null;

  const Footer = reduce ? View : Animated.View;
  const footerProps = reduce
    ? {}
    : { entering: FadeInDown.delay(360).duration(380).damping(22) };

  return (
    <ScrollableScreen contentContainerStyle={{ paddingBottom: scrollBottomPad }}>
      {showOfflineBanner ? <OfflineBanner /> : null}

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xs }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
            }}
          >
            {t('mobile.more.pulseEyebrow')}
          </AppText>
          <AppText variant="title" weight={titleWeight}>
            {t('mobile.more.title')}
          </AppText>
          <AppText variant="caption" color="muted" weight="regular">
            {t('mobile.more.subtitle')}
          </AppText>
        </View>

        {canNotify ? (
          <AnimatedPressable
            variant="button"
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
              marginTop: 2,
            }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.brand} />
            {unread > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 4,
                  ...(isRTL ? { left: 4 } : { right: 4 }),
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: colors.warning,
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
                  {unread > 99 ? '99+' : String(unread)}
                </AppText>
              </View>
            ) : null}
          </AnimatedPressable>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <MoreIdentityBoard user={user} />
        <MorePreferencesBoard />
        <MoreFloorCommand />

        <Divider />

        <Footer {...footerProps} style={{ gap: theme.spacing.sm }}>
          <DestructiveButton
            label={t('auth.logout')}
            onPress={() => {
              void logout().then(() => router.replace('/(auth)/login' as Href));
            }}
            style={{ borderRadius: theme.radius.xl }}
          />
        </Footer>
      </View>
    </ScrollableScreen>
  );
}
