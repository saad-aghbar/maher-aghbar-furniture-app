import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { globalSearch } from '@/api/modules/search';
import { flattenPaginatedPages, getNextPageParamFromMeta } from '@/api/infinite';
import { queryKeys } from '@/api/queryKeys';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { searchHitHref } from '@/features/search/searchHits';
import { SearchHitCard } from '@/features/search/SearchHitCard';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  query: string;
};

/** In-place entity search results under the home search row. */
export function AdminHomeSearchResults({ query }: Props) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const q = useDebouncedValue(query.trim(), 300);

  const canSearch =
    can(user, 'catalog.read') ||
    can(user, 'sales-order.read') ||
    can(user, 'invoice.read') ||
    can(user, 'inventory.read') ||
    can(user, 'request.read') ||
    can(user, 'customer.read');

  const searchQuery = useInfiniteQuery({
    queryKey: queryKeys.search.list({ q }),
    queryFn: ({ pageParam }) => globalSearch({ q, page: pageParam, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled: canSearch && q.length >= 1,
  });

  const hits = flattenPaginatedPages(searchQuery.data?.pages);
  const Shell = reduce ? View : Animated.View;

  if (!canSearch) {
    return (
      <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
    );
  }

  if (q.length < 1) {
    return (
      <Shell entering={reduce ? undefined : softFadeDown(40)}>
        <EmptyState
          title={t('mobile.search.hintTitle')}
          description={t('mobile.search.hintBody')}
        />
      </Shell>
    );
  }

  if (searchQuery.isError) {
    return (
      <ErrorState
        title={t('mobile.search.errorTitle')}
        description={t('mobile.search.errorBody')}
        retryLabel={t('mobile.search.retry')}
        onRetry={() => void searchQuery.refetch()}
      />
    );
  }

  if (searchQuery.isFetching && hits.length === 0) {
    return (
      <AppText color="secondary" style={{ marginTop: theme.spacing.md }}>
        {t('mobile.search.loading')}
      </AppText>
    );
  }

  if (hits.length === 0) {
    return (
      <EmptyState
        title={t('mobile.search.emptyTitle')}
        description={t('mobile.search.emptyBody')}
      />
    );
  }

  return (
    <Shell
      entering={reduce ? undefined : softFadeDown(40)}
      style={{ gap: theme.spacing.md }}
    >
      {hits.map((item) => (
        <SearchHitCard
          key={`${item.type}-${item.id}`}
          hit={item}
          onPress={() => router.push(searchHitHref(item.type, item.id, user?.customerId))}
        />
      ))}
      {searchQuery.hasNextPage ? (
        <AnimatedPressable
          variant="button"
          onPress={() => {
            void haptics.selection();
            if (!searchQuery.isFetchingNextPage) void searchQuery.fetchNextPage();
          }}
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText variant="label" weight="semibold" color="brand">
            {searchQuery.isFetchingNextPage
              ? t('mobile.search.loading')
              : t('mobile.adminHome.searchLoadMore')}
          </AppText>
        </AnimatedPressable>
      ) : null}
    </Shell>
  );
}
