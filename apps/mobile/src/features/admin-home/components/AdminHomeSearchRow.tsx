import { HomeSearchRow } from '@/components/chrome/HomeSearchRow';
import { useRouter, type Href } from 'expo-router';
import { useLocale } from '@/i18n';

type Props = {
  enterDelay?: number;
};

/** @deprecated Prefer HomeSearchRow — kept so existing imports keep working. */
export function AdminHomeSearchRow({ enterDelay: _enterDelay = 160 }: Props) {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <HomeSearchRow
      placeholder={t('mobile.adminHome.searchPlaceholder')}
      onSearchPress={() => router.push('/(app)/search' as Href)}
      filterA11y={t('mobile.adminHome.filterA11y')}
      onFilterPress={() => router.push('/(app)/(admin)/(tabs)/orders' as Href)}
    />
  );
}
