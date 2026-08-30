import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  HomeHeroHeader,
  greetingPeriod,
} from '@/components/chrome/HomeHeroHeader';
import { HomeSearchRow } from '@/components/chrome/HomeSearchRow';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type WorkerHomeHeaderProps = {
  userName: string;
  unreadNotifications: number;
  canOpenNotifications: boolean;
};

/**
 * Worker home top chrome — same EST / greeting / watermark / search as admin home.
 */
export function WorkerHomeHeader({
  userName,
  unreadNotifications,
  canOpenNotifications,
}: WorkerHomeHeaderProps) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const router = useRouter();
  const period = greetingPeriod(new Date().getHours());
  const firstName = userName.trim().split(/\s+/)[0] || userName;

  return (
    <HomeHeroHeader
      estLine={t('mobile.adminHome.estLine')}
      greetingLead={t(`mobile.workerHome.greetingLead.${period}`)}
      name={firstName}
      welcome={t('mobile.persona.production_worker')}
      unreadNotifications={unreadNotifications}
      canOpenNotifications={canOpenNotifications}
      notificationsA11y={t('mobile.workerHome.notificationsA11y')}
      onNotificationsPress={() =>
        router.push('/(app)/(employee)/(tabs)/notifications' as Href)
      }
    >
      <View style={{ marginTop: theme.spacing.sm }}>
        <HomeSearchRow
          placeholder={t('mobile.adminHome.searchPlaceholder')}
          onSearchPress={() => router.push('/(app)/search' as Href)}
        />
      </View>
    </HomeHeroHeader>
  );
}
