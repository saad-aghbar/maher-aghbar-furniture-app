import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { HomeHeroHeader } from '@/components/chrome/HomeHeroHeader';
import { HomeSearchRow } from '@/components/chrome/HomeSearchRow';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type DealerHomeHeaderProps = {
  greeting: string;
  unreadNotifications: number;
  canOpenNotifications: boolean;
};

/** EST. 1995 + greeting + circular chrome — same home language as admin. */
export function DealerHomeHeader({
  greeting,
  unreadNotifications,
  canOpenNotifications,
}: DealerHomeHeaderProps) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <HomeHeroHeader
      estLine={t('mobile.adminHome.estLine')}
      greetingLead={greeting}
      name=""
      welcome={undefined}
      unreadNotifications={unreadNotifications}
      canOpenNotifications={canOpenNotifications}
      notificationsA11y={t('mobile.dealerHome.notificationsA11y')}
      onNotificationsPress={() => router.push('/(app)/notifications' as Href)}
    >
      <View style={{ marginTop: theme.spacing.sm }}>
        <HomeSearchRow
          placeholder={t('mobile.search.placeholder')}
          onSearchPress={() => router.push('/(app)/search' as Href)}
        />
      </View>
    </HomeHeroHeader>
  );
}
