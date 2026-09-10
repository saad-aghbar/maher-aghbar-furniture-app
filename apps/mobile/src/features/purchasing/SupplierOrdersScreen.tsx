import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { PurchaseOrderBoardCard } from './components/PurchaseOrderBoardCard';
import { PurchasingSkeleton } from './components/PurchasingSkeleton';
import { flattenPurchaseOrders, usePurchaseOrdersInfiniteQuery, useSupplierDetailQuery } from './query';
import { localizedNamed, selectPurchaseCard } from './selectPurchase';

type Props = { supplierId: string };

export function SupplierOrdersScreen({ supplierId }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const canRead = can(user, 'purchase-order.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = `/(app)/(admin)/purchasing/suppliers/${supplierId}` as Href;
  const [search, setSearch] = useState('');
  const supplierQuery = useSupplierDetailQuery(supplierId, can(user, 'supplier.read'));
  const query = usePurchaseOrdersInfiniteQuery(
    { supplierId, q: search.trim() || undefined },
    canRead,
  );
  const cards = useMemo(
    () => flattenPurchaseOrders(query.data).map((po) => selectPurchaseCard(po, locale)),
    [query.data, locale],
  );
  const name = supplierQuery.data ? localizedNamed(locale, supplierQuery.data) : '';

  if (!canRead) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }
  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <ErrorState
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: theme.spacing.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.brand} />
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="largeTitle" weight={titleWeight} align="center">
              {t('mobile.purchasing.supplierOrdersTitle')}
            </AppText>
            {name ? (
              <AppText color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {name}
              </AppText>
            ) : null}
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                padding: theme.spacing.md,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <TextField
                value={search}
                onChangeText={setSearch}
                placeholder={t('mobile.purchasing.searchOrders')}
                autoCorrect={false}
                autoCapitalize="none"
                pill
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <PurchasingSkeleton />
          ) : (
            <DealerEmptyPanel text={t('mobile.purchasing.openOrdersEmpty')} icon="cart-outline" />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <PurchaseOrderBoardCard
              order={item}
              onPress={() => {
                const href =
                  item.runId && (item.runSupplierCount ?? 0) > 1
                    ? `/(app)/(admin)/purchasing/runs/${item.runId}`
                    : `/(app)/(admin)/purchasing/${item.id}`;
                router.push(href as Href);
              }}
            />
          </ListItemEnter>
        )}
      />
    </AppScreen>
  );
}
