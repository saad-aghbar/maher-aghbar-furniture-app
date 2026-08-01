import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { useListQuery } from '../../api/hooks';
import { useI18n } from '../../providers/i18n-provider';
import { colors, spacing } from '../../theme/tokens';
import { Chip, ChipGroup } from '../../ui/Chip';
import { TextField } from '../../ui/Field';
import { EmptyState, ErrorState, ListSkeleton } from '../../ui/States';

export type StatusFilter = {
  /** Backend enum value, or `null` for "all". */
  value: string | null;
  labelKey: string;
  labelFallback: string;
};

/**
 * Standard module list: search box, status chips, pull-to-refresh, and the
 * loading / error / empty states. Callers only provide the row renderer.
 */
export function ListScreen<T extends { id: string }>({
  queryKey,
  basePath,
  renderItem,
  filters,
  searchable = true,
  emptyTitle,
  emptyDescription,
  header,
  /** Client-side predicate applied after fetching, e.g. "assigned to me". */
  filterFn,
  sortFn,
}: {
  queryKey: string;
  basePath: string;
  renderItem: (item: T) => React.ReactElement;
  filters?: readonly StatusFilter[];
  searchable?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  header?: React.ReactNode;
  filterFn?: (item: T) => boolean;
  sortFn?: (a: T, b: T) => number;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '50' });
    if (search.trim()) params.set('q', search.trim());
    if (status) params.set('status', status);
    const sep = basePath.includes('?') ? '&' : '?';
    return `${basePath}${sep}${params.toString()}`;
  }, [basePath, search, status]);

  const query = useListQuery<T>([queryKey, search, status], path);

  const rows = useMemo(() => {
    let out = query.rows;
    if (filterFn) out = out.filter(filterFn);
    if (sortFn) out = [...out].sort(sortFn);
    return out;
  }, [query.rows, filterFn, sortFn]);

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => renderItem(item)}
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
          {header}
          {searchable ? (
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
          {filters && filters.length > 0 ? (
            <ChipGroup>
              {filters.map((f) => (
                <Chip
                  key={f.value ?? 'all'}
                  label={t(f.labelKey, f.labelFallback)}
                  active={status === f.value}
                  onPress={() => setStatus(f.value)}
                />
              ))}
            </ChipGroup>
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
            icon={<Search size={36} color={colors.textTertiary} />}
            title={emptyTitle}
            description={emptyDescription}
          />
        )
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

export const ALL_FILTER: StatusFilter = {
  value: null,
  labelKey: 'common.all',
  labelFallback: 'All',
};

/** Builds chip filters from backend enum values, translated via `statuses.*`. */
export function statusFilters(...values: string[]): StatusFilter[] {
  return [
    ALL_FILTER,
    ...values.map((value) => ({
      value,
      labelKey: `statuses.${value}`,
      labelFallback: value,
    })),
  ];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  separator: { height: spacing.sm },
});
