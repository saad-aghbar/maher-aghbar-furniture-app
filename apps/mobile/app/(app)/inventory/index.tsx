import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { PackageSearch } from 'lucide-react-native';
import { useArrayQuery, useListQuery } from '../../../src/api/hooks';
import type { LowStockRow } from '../../../src/features/home/use-home-data';
import { formatNumber } from '../../../src/lib/format';
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

type InventoryItemRow = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  unitOfMeasure?: string | null;
  minStock?: unknown;
  balances?: {
    quantityOnHand?: unknown;
    quantityReserved?: unknown;
    warehouse?: { nameEn?: string; nameAr?: string } | null;
  }[];
};

type Mode = 'items' | 'low-stock';

function availableQty(item: InventoryItemRow): number {
  return (item.balances ?? []).reduce((sum, b) => {
    return sum + (Number(b.quantityOnHand) || 0) - (Number(b.quantityReserved) || 0);
  }, 0);
}

export default function InventoryScreen() {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<Mode>('items');
  const [search, setSearch] = useState('');

  const itemsPath = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '50' });
    if (search.trim()) params.set('q', search.trim());
    return `/inventory/items?${params.toString()}`;
  }, [search]);

  const itemsQuery = useListQuery<InventoryItemRow>(
    ['inventory', 'items', search],
    itemsPath,
    { enabled: mode === 'items' },
  );
  const lowStockQuery = useArrayQuery<LowStockRow>(
    ['inventory', 'low-stock'],
    '/inventory/low-stock',
    { enabled: mode === 'low-stock' },
  );

  const query = mode === 'items' ? itemsQuery : lowStockQuery;
  const rows = mode === 'items' ? itemsQuery.rows : lowStockQuery.rows;

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.inventory', 'Inventory') }} />
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={rows as (InventoryItemRow | LowStockRow)[]}
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
            <ChipGroup>
              <Chip
                label={t('mobile.items', 'Items')}
                active={mode === 'items'}
                onPress={() => setMode('items')}
              />
              <Chip
                label={t('inventory.lowStock', 'Low stock')}
                active={mode === 'low-stock'}
                onPress={() => setMode('low-stock')}
              />
            </ChipGroup>
            {mode === 'items' ? (
              <TextField
                value={search}
                onChangeText={setSearch}
                placeholder={t('common.search', 'Search')}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={t('common.search', 'Search')}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <ListSkeleton />
          ) : query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : (
            <EmptyState
              icon={<PackageSearch size={36} color={colors.textTertiary} />}
              title={
                mode === 'low-stock'
                  ? t('mobile.stockHealthy', 'All items above minimum')
                  : t('inventory.empty', 'No inventory items')
              }
            />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          if (mode === 'low-stock') {
            const row = item as LowStockRow;
            return (
              <ListRow
                title={localizedName(locale, row, row.sku)}
                meta={row.sku}
                description={`${t('inventory.available', 'Available')}: ${formatNumber(row.availableQty)}`}
                right={<StatusBadge status="LOW" tone="warning" />}
                accent={colors.warning}
              />
            );
          }

          const row = item as InventoryItemRow;
          const available = availableQty(row);
          const min = Number(row.minStock) || 0;
          const isLow = available <= min;
          return (
            <ListRow
              title={localizedName(locale, row, row.sku)}
              meta={row.sku}
              description={`${t('inventory.available', 'Available')}: ${formatNumber(available)}`}
              right={
                isLow ? (
                  <StatusBadge status="LOW" tone="warning" />
                ) : (
                  <StatusBadge status="OK" tone="success" />
                )
              }
              accent={isLow ? colors.warning : undefined}
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
