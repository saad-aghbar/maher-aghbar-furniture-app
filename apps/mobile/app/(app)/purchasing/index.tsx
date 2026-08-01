import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { useListQuery } from '../../../src/api/hooks';
import { formatDate, formatMoney } from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { can } from '../../../src/permissions/can';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors, spacing } from '../../../src/theme/tokens';
import {
  Chip,
  ChipGroup,
  EmptyState,
  ErrorState,
  ListRow,
  ListSkeleton,
  StatusBadge,
  TextField,
} from '../../../src/ui';

type PurchaseOrderRow = {
  id: string;
  number: string;
  status: string;
  totalAmount?: unknown;
  total?: unknown;
  currency?: string | null;
  expectedDate?: string | null;
  expectedDeliveryDate?: string | null;
  createdAt: string;
  supplier?: {
    nameEn?: string | null;
    nameAr?: string | null;
    name?: string | null;
  } | null;
};

type PurchaseRequestRow = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  requestedBy?: { firstName?: string | null; lastName?: string | null } | null;
  lines?: { id: string }[];
};

type Mode = 'orders' | 'requests';

export default function PurchasingScreen() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useNav();

  const canOrders = can(user, 'purchase-order.read');
  const canRequests = can(user, 'purchase-request.read');
  const [mode, setMode] = useState<Mode>(canOrders ? 'orders' : 'requests');
  const [search, setSearch] = useState('');

  const ordersPath = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '50' });
    if (search.trim()) params.set('q', search.trim());
    return `/purchase-orders?${params.toString()}`;
  }, [search]);

  const requestsPath = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '50' });
    if (search.trim()) params.set('q', search.trim());
    return `/purchase-requests?${params.toString()}`;
  }, [search]);

  const ordersQuery = useListQuery<PurchaseOrderRow>(
    ['purchase-orders', search],
    ordersPath,
    { enabled: canOrders && mode === 'orders' },
  );
  const requestsQuery = useListQuery<PurchaseRequestRow>(
    ['purchase-requests', search],
    requestsPath,
    { enabled: canRequests && mode === 'requests' },
  );

  const query = mode === 'orders' ? ordersQuery : requestsQuery;
  const rows = mode === 'orders' ? ordersQuery.rows : requestsQuery.rows;

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.purchasing', 'Purchasing') }} />
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={rows as (PurchaseOrderRow | PurchaseRequestRow)[]}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {canOrders && canRequests ? (
              <ChipGroup>
                <Chip
                  label={t('catalog.purchaseOrders', 'Purchase orders')}
                  active={mode === 'orders'}
                  onPress={() => setMode('orders')}
                />
                <Chip
                  label={t('catalog.purchaseRequests', 'Purchase requests')}
                  active={mode === 'requests'}
                  onPress={() => setMode('requests')}
                />
              </ChipGroup>
            ) : null}
            <TextField
              value={search}
              onChangeText={setSearch}
              placeholder={t('common.search', 'Search')}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={t('common.search', 'Search')}
            />
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <ListSkeleton />
          ) : query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : (
            <EmptyState
              icon={<Search size={36} color={colors.textTertiary} />}
              title={
                mode === 'orders'
                  ? t('catalog.noPurchaseOrders', 'No purchase orders')
                  : t('catalog.noPurchaseRequests', 'No purchase requests')
              }
            />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          if (mode === 'orders') {
            const row = item as PurchaseOrderRow;
            const currency = row.currency ?? 'JOD';
            const total = row.totalAmount ?? row.total;
            return (
              <ListRow
                title={localizedName(
                  locale,
                  row.supplier
                    ? {
                        nameEn: row.supplier.nameEn ?? row.supplier.name,
                        nameAr: row.supplier.nameAr,
                      }
                    : null,
                  row.number,
                )}
                meta={`${row.number} · ${formatMoney(total, currency)}`}
                right={<StatusBadge status={row.status} />}
                onPress={() => router.push(`/purchasing/${row.id}`)}
              />
            );
          }

          const row = item as PurchaseRequestRow;
          return (
            <ListRow
              title={row.number}
              meta={formatDate(row.createdAt)}
              description={`${row.lines?.length ?? 0} ${t('common.items', 'items')}`}
              right={<StatusBadge status={row.status} />}
            />
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  separator: { height: spacing.sm },
});
