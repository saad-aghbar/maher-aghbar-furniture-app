import { FlatList, RefreshControl, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { listQuotations } from '@/api/modules/quotations';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

type Props = {
  detailHref: (id: string) => Href;
  backFallback: Href;
};

export function DealerQuotationsListScreen({ detailHref, backFallback }: Props) {
  const { user } = useAuth();
  const { t, formatCurrency, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const { showOfflineBanner } = useNetwork();
  const allowed = can(user, 'quotation.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const query = useQuery({
    queryKey: queryKeys.quotations.list({ dealer: true }),
    queryFn: () => listQuotations({ pageSize: 50 }),
    enabled: allowed,
  });

  const rows = query.data?.data ?? [];

  return (
    <AppScreen edges={{ top: true, bottom: false }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, flex: 1 }}>
        <View style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, zIndex: 1, justifyContent: 'center' }}>
            <ScreenBackLead fallback={backFallback} />
          </View>
          <AppText variant="largeTitle" weight={titleWeight} style={{ textAlign: 'center' }}>
            {t('mobile.dealerQuotations.title')}
          </AppText>
        </View>
        {showOfflineBanner ? <OfflineBanner /> : null}
        {query.isError ? (
          <ErrorState title={t('mobile.dealerQuotations.title')} onRetry={() => void query.refetch()} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
              flexGrow: 1,
              gap: theme.spacing.md,
            }}
            refreshControl={
              <RefreshControl
                refreshing={query.isRefetching}
                onRefresh={() => void query.refetch()}
                tintColor={colors.brand}
              />
            }
            ListEmptyComponent={
              query.isLoading ? null : (
                <EmptyState
                  title={t('mobile.dealerQuotations.empty')}
                  description={t('mobile.dealerQuotations.emptyHint')}
                />
              )
            }
            renderItem={({ item, index }) => (
              <ListItemEnter index={index}>
                <AnimatedPressable
                  variant="card"
                  onPress={() => {
                    void haptics.selection();
                    router.push(detailHref(item.id));
                  }}
                  style={{
                    borderRadius: theme.radius.xl,
                    backgroundColor: colors.surface,
                    padding: theme.spacing.lg,
                    ...orderBoardShadow(colorScheme),
                    gap: theme.spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <AppText variant="title" weight={titleWeight} dir="ltr">
                      {item.number}
                      {item.version ? ` v${item.version}` : ''}
                    </AppText>
                    <StatusBadge status={item.status} dot />
                  </View>
                  {item.total != null ? (
                    <AppText variant="body" weight="medium" dir="ltr">
                      {formatCurrency(Number(item.total))}
                    </AppText>
                  ) : null}
                </AnimatedPressable>
              </ListItemEnter>
            )}
          />
        )}
      </View>
    </AppScreen>
  );
}
