import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { InventoryGroupCard } from './components/InventoryGroupCard';
import { InventoryGroupsSkeleton } from './components/InventorySkeleton';
import { useInventoryGroupsQuery } from './query';

/** Classic groups hub — kept for INVENTORY_COMPOSITION = 'classic' rollback. */
export function InventoryGroupsClassicScreen() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const allowed = can(user, 'inventory.read');

  const query = useInventoryGroupsQuery(allowed);
  const refreshing = query.isRefetching;

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <AppScreen>
        <AppText variant="title" weight="semibold">
          {t('mobile.inventory.title')}
        </AppText>
        <InventoryGroupsSkeleton />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.inventory.errorTitle')}
          description={t('mobile.inventory.errorBody')}
          retryLabel={t('mobile.inventory.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const groups = query.data ?? [];

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={groups}
        keyExtractor={(g) => g.categoryGroup}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void query.refetch()} />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.sm, gap: theme.spacing.xs }}>
            <AppText
              variant="caption"
              weight={locale === 'ar' ? 'regular' : 'medium'}
              style={{
                letterSpacing: locale === 'ar' ? 0 : 1.4,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                color: colors.brand,
              }}
            >
              {t('mobile.inventory.pulseEyebrow')}
            </AppText>
            <AppText variant="title" weight={locale === 'ar' ? 'medium' : 'semibold'}>
              {t('mobile.inventory.title')}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('mobile.inventory.subtitle')}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('mobile.inventory.emptyGroupsTitle')}
            description={t('mobile.inventory.emptyGroupsBody')}
          />
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <InventoryGroupCard
              group={item}
              onPress={() =>
                router.push(`/(app)/(admin)/inventory/${item.categoryGroup}` as Href)
              }
            />
          </ListItemEnter>
        )}
      />
    </AppScreen>
  );
}
