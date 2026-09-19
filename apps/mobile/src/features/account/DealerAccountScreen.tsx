import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { FontScaleSwitcher } from '@/components/FontScaleSwitcher';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { StickyLogoutDock } from '@/components/layout/StickyLogoutDock';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useDealerHomeQuery } from '@/features/dealer-home/query';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useSurfaceClearance } from '@/adaptive/useSurfaceClearance';
import { useChromeSize, useTheme } from '@/theme';
import { DealerAiSpotlight } from './components/DealerAiSpotlight';
import { DealerIdentityBoard } from './components/DealerIdentityBoard';
import { DealerPlacesDock } from './components/DealerPlacesDock';
import { DealerPreferencesBoard } from './components/DealerPreferencesBoard';

/**
 * Dealer Account hub — floor / atelier composition matching Admin More.
 */
export function DealerAccountScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const pip = useChromeSize(16);
  const surfaceClearance = useSurfaceClearance();
  const { showOfflineBanner } = useNetwork();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canNotify = can(user, 'notification.read');
  const homeQuery = useDealerHomeQuery(
    Boolean(user?.customerId) && canNotify,
  );
  const unread = homeQuery.data?.unreadNotifications ?? 0;

  if (!user) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollableScreen contentContainerStyle={{ paddingBottom: theme.spacing.lg }}>
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
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.dealerAccount.eyebrow')}
          </AppText>
          <AppText
            variant="title"
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.tabs.account')}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            weight="regular"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.dealerAccount.subtitle')}
          </AppText>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.sm,
            marginTop: 2,
            zIndex: 40,
          }}
        >
          <FontScaleSwitcher expandToward={isRTL ? 'start' : 'end'} />
          {canNotify ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.notifications.title')}
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
            }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.brand} />
            {unread > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 4,
                  ...(isRTL ? { left: 4 } : { right: 4 }),
                  minWidth: pip,
                  height: pip,
                  borderRadius: pip / 2,
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
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <DealerIdentityBoard user={user} />
        <DealerPreferencesBoard />
        <DealerPlacesDock />
        <DealerAiSpotlight />
      </View>
      </ScrollableScreen>
      </View>
      <StickyLogoutDock paddingBottom={surfaceClearance} />
    </View>
  );
}
