import { FlatList, RefreshControl, View } from 'react-native';
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { statusLabel } from '@maher/i18n';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { globalSearch } from '@/api/modules/search';
import { queryKeys } from '@/api/queryKeys';
import { flattenPaginatedPages, getNextPageParamFromMeta } from '@/api/infinite';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { TextField } from '@/components/forms/TextField';
import { localizeStatusPrefixedText } from '@/components/badges/statusDisplay';
import { AppScreen } from '@/components/layout/AppScreen';
import { ListRow } from '@/components/layout/ListRow';
import { useNetwork } from '@/components/network/NetworkProvider';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { parseInvoiceSearchSubtitle } from './selectSearchHit';

function hitHref(type: string, id: string, userCustomerId?: string | null): Href {
  switch (type) {
    case 'product':
      return (userCustomerId
        ? `/(app)/(customer)/catalog/${id}`
        : `/(app)/(admin)/products/${id}`) as Href;
    case 'sales_order':
      return (userCustomerId
        ? `/(app)/(customer)/orders/${id}`
        : `/(app)/(admin)/orders/${id}`) as Href;
    case 'invoice':
      return (userCustomerId
        ? `/(app)/(customer)/invoices/${id}`
        : `/(app)/(admin)/invoices/${id}`) as Href;
    case 'inventory':
      return `/(app)/(admin)/inventory/items/${id}` as Href;
    case 'request':
      return `/(app)/(customer)/requests` as Href;
    default:
      return '/(app)/search' as Href;
  }
}

function SearchHitMeta({
  type,
  subtitle,
}: {
  type: string;
  subtitle?: string | null;
}) {
  const { formatCurrency, isRTL } = useLocale();
  const { theme } = useTheme();

  if (type === 'invoice') {
    const parsed = parseInvoiceSearchSubtitle(subtitle);
    if (parsed) {
      return (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: 2,
          }}
        >
          <StatusBadge status={parsed.status} dot />
          <AppText variant="caption" color="secondary" dir="ltr">
            {formatCurrency(parsed.amount)}
          </AppText>
        </View>
      );
    }
  }

  if (!subtitle) return null;
  return (
    <AppText variant="caption" color="secondary">
      {subtitle}
    </AppText>
  );
}

export function GlobalSearchScreen() {
  const { user } = useAuth();
  const { t, locale, formatCurrency } = useLocale();
  const { theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const canSearch =
    can(user, 'catalog.read') ||
    can(user, 'sales-order.read') ||
    can(user, 'invoice.read') ||
    can(user, 'inventory.read') ||
    can(user, 'request.read') ||
    can(user, 'customer.read');

  const query = useInfiniteQuery({
    queryKey: queryKeys.search.list({ q }),
    queryFn: ({ pageParam }) => globalSearch({ q, page: pageParam, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled: canSearch && q.length >= 1,
  });

  const hits = flattenPaginatedPages(query.data?.pages);

  if (!canSearch) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={'/(app)/(admin)/(tabs)' as Href}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={hits}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
          />
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <AppText variant="title" weight="semibold">
              {t('mobile.search.title')}
            </AppText>
            <TextField
              value={search}
              onChangeText={setSearch}
              placeholder={t('mobile.search.placeholder')}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel={t('mobile.search.placeholder')}
            />
          </View>
        }
        ListEmptyComponent={
          q.length < 1 ? (
            <EmptyState
              title={t('mobile.search.hintTitle')}
              description={t('mobile.search.hintBody')}
            />
          ) : query.isError ? (
            <ErrorState
              title={t('mobile.search.errorTitle')}
              description={t('mobile.search.errorBody')}
              retryLabel={t('mobile.search.retry')}
              onRetry={() => void query.refetch()}
            />
          ) : query.isFetching ? (
            <AppText color="secondary">{t('mobile.search.loading')}</AppText>
          ) : (
            <EmptyState
              title={t('mobile.search.emptyTitle')}
              description={t('mobile.search.emptyBody')}
            />
          )
        }
        renderItem={({ item, index }) => {
          const invoiceMeta =
            item.type === 'invoice' ? parseInvoiceSearchSubtitle(item.subtitle) : null;
          const localizedSubtitle = item.subtitle
            ? localizeStatusPrefixedText(locale, item.subtitle)
            : null;
          const a11yMeta = invoiceMeta
            ? `${statusLabel(locale, invoiceMeta.status)} ${formatCurrency(invoiceMeta.amount)}`
            : (localizedSubtitle ?? '');
          return (
            <ListItemEnter index={index}>
              <SurfaceCard
                onPress={() => router.push(hitHref(item.type, item.id, user?.customerId))}
                accessibilityLabel={`${item.title}. ${a11yMeta}`}
                style={{ minHeight: theme.sizes.touch.min }}
              >
                <ListRow
                  eyebrow={t(`mobile.search.types.${item.type}`)}
                  title={item.title}
                  subtitle={invoiceMeta ? null : localizedSubtitle}
                  titleDir="ltr"
                  chevron
                  trailing={
                    item.type === 'invoice' ? (
                      <SearchHitMeta type={item.type} subtitle={item.subtitle} />
                    ) : undefined
                  }
                />
              </SurfaceCard>
            </ListItemEnter>
          );
        }}
      />
    </AppScreen>
  );
}
