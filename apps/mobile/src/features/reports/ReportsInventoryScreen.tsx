import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { OrdersSearchBar } from '@/features/sales-orders/components/OrdersSearchBar';
import { localizedName } from '@maher/i18n';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { CostFilterSheet } from './components/CostFilterSheet';
import { CostMoneyLine } from './components/CostMoneyLine';
import { CostPressableRow } from './components/CostPressableRow';
import { ReportsDeskHeader } from './components/ReportsDeskHeader';
import { ReportsFilterBar } from './components/ReportsFilterBar';
import { formatCostMoney, formatCostPercent } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useCostFilterChrome } from './useCostFilterChrome';
import { useReportsDeskFilters } from './reportsDeskFilters';
import { useReportsPeriod } from './reportsPeriod';
import { inventoryItemHref } from './reportsDeskHrefs';
import { useCostInventoryFlowQuery, useCostInventoryItemsQuery, useCostInventorySummaryQuery } from './query';
import type { CostInventoryItem } from '@/api/modules/reports';

const FLOW_ROWS = [
  { i18n: 'receipts', flow: 'receipt', legacy: 'receipts' },
  { i18n: 'issues', flow: 'productionIssue', legacy: 'issues' },
  { i18n: 'unusedReturns', flow: 'productionReturn', legacy: 'unusedReturns' },
  { i18n: 'wipOutput', flow: 'wipOutput', legacy: 'wipOutput' },
  { i18n: 'finishedOutput', flow: 'finishedOutput', legacy: 'finishedOutput' },
  { i18n: 'scrap', flow: 'scrap', legacy: 'scrap' },
  { i18n: 'recovery', flow: 'recovery', legacy: 'recovery' },
  { i18n: 'transfer', flow: 'transfer', legacy: 'transfer', neutral: true },
  { i18n: 'adjustment', flow: 'adjustment', legacy: 'adjustment' },
] as const;

const CLASS_FILTER: Record<string, 'RAW' | 'SEMI' | 'FIN'> = {
  RAW_MATERIAL: 'RAW',
  SEMI_FINISHED_GOOD: 'SEMI',
  FINISHED_GOOD: 'FIN',
};

export function ReportsInventoryScreen() {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range, dateBasis } = useReportsPeriod();
  const chrome = useCostFilterChrome('inventory');
  const scrollPad = useCostFloorScrollPad();
  const { search, setSearch } = useReportsDeskFilters('inventory');
  const debounced = useDebouncedValue(search, 300);
  const summary = useCostInventorySummaryQuery(true);
  const flow = useCostInventoryFlowQuery(range, true);
  const items = useCostInventoryItemsQuery(chrome.filter, true, { q: debounced || undefined });
  const rows = items.data?.data ?? [];

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={Boolean(items.isFetching && !items.isLoading)}
            onRefresh={() => {
              void summary.refetch();
              void flow.refetch();
              void items.refetch();
            }}
          />
        }
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: scrollPad, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            <ReportsDeskHeader desk="inventory">
              <OrdersSearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('mobile.reports.searchInventory')}
              />
              <ReportsFilterBar
                filter={chrome.filter}
                chips={
                  [
                    chrome.filter.lifecycle
                      ? {
                          key: 'lifecycle' as const,
                          label: t(`mobile.reports.lifecycle.${chrome.filter.lifecycle}`),
                        }
                      : null,
                    chrome.filter.sort
                      ? { key: 'sort' as const, label: t(`mobile.reports.sort.${chrome.filter.sort}`) }
                      : null,
                  ].filter(Boolean) as Array<{ key: 'lifecycle' | 'sort'; label: string }>
                }
                onOpen={chrome.openFilters}
                onClear={chrome.reset}
                onRemove={(key) => chrome.setFilter({ ...chrome.filter, [key]: null })}
              />
            </ReportsDeskHeader>
            {summary.isError ? (
              <ErrorState title={t('common.loadFailed')} onRetry={() => void summary.refetch()} />
            ) : null}
            <DealerBoard title={t('mobile.reports.currentInventoryValue')} titleWeight={titleWeight}>
              {summary.isLoading && !summary.data ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="title" weight={titleWeight} dir="ltr">
                    {formatCostMoney(locale, summary.data?.total ?? null)}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.reports.inventoryCurrentHint')} ·{' '}
                    {formatCostPercent(locale, summary.data?.coveragePct ?? null)}
                  </AppText>
                  {(['RAW_MATERIAL', 'SEMI_FINISHED_GOOD', 'FINISHED_GOOD'] as const).map((cls) => (
                    <CostPressableRow
                      key={cls}
                      accessibilityLabel={t(`mobile.reports.lifecycleClass.${cls}`)}
                      onPress={() =>
                        chrome.setFilter({ ...chrome.filter, lifecycle: CLASS_FILTER[cls] ?? null })
                      }
                    >
                      <CostMoneyLine
                        label={t(`mobile.reports.lifecycleClass.${cls}`)}
                        value={formatCostMoney(locale, summary.data?.byClass?.[cls]?.value ?? null)}
                      />
                    </CostPressableRow>
                  ))}
                  <View
                    style={{
                      borderRadius: theme.radius.lg,
                      backgroundColor: colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: theme.spacing.md,
                      gap: theme.spacing.sm,
                    }}
                  >
                    {(summary.data?.rawGroups ?? []).map((group) => (
                      <CostMoneyLine
                        key={group.group}
                        muted
                        label={t(`mobile.reports.rawGroup.${group.group}`)}
                        value={formatCostMoney(locale, group.value)}
                      />
                    ))}
                  </View>
                </View>
              )}
            </DealerBoard>
            <DealerBoard title={t('mobile.reports.inventoryFlow')} titleWeight={titleWeight}>
              {flow.data ? (
                <View style={{ gap: theme.spacing.sm }}>
                  {FLOW_ROWS.map((row) => {
                    const nested = flow.data?.flow?.[row.flow as keyof NonNullable<typeof flow.data.flow>];
                    const value = nested ?? flow.data?.[row.legacy as 'receipts' | 'issues' | 'unusedReturns' | 'wipOutput' | 'finishedOutput' | 'scrap'];
                    return (
                      <View key={row.i18n} testID={`cost-flow-${row.i18n}`} style={{ gap: 2 }}>
                        <CostMoneyLine
                          muted={Boolean('neutral' in row && row.neutral)}
                          label={t(`mobile.reports.flow.${row.i18n}`)}
                          value={formatCostMoney(locale, value ?? null)}
                        />
                        {'neutral' in row && row.neutral ? (
                          <AppText variant="caption" color="muted">
                            {t('mobile.reports.flowTransferHint')}
                          </AppText>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <DealerEmptyPanel nested compact text={t('accounting.noData')} />
              )}
            </DealerBoard>
          </View>
        }
        ListEmptyComponent={
          items.isLoading ? (
            <DealerBoard title={t('mobile.reports.tabs.inventory')} titleWeight={titleWeight}>
              <ActivityIndicator color={colors.brand} />
            </DealerBoard>
          ) : (
            <DealerEmptyPanel text={t('accounting.noData')} />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <InventoryItemCard
              row={item}
              onPress={() =>
                router.push(inventoryItemHref(item.id, { from: range.from, to: range.to, dateBasis }))
              }
            />
          </ListItemEnter>
        )}
      />
      <CostFilterSheet
        open={chrome.filterOpen}
        desk="inventory"
        onClose={() => chrome.setFilterOpen(false)}
        value={chrome.draft}
        onChange={chrome.setDraft}
        onApply={chrome.apply}
        onReset={chrome.reset}
      />
    </AppScreen>
  );
}

function InventoryItemCard({ row, onPress }: { row: CostInventoryItem; onPress: () => void }) {
  const { locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedName(locale, row, row.sku);
  return (
    <DealerBoard title={row.sku} titleWeight={titleWeight}>
      <CostPressableRow accessibilityLabel={row.sku} testID={`cost-inventory-item-${row.id}`} onPress={onPress}>
        <AppText>{name}</AppText>
        <AppText variant="caption" dir="ltr">
          {formatCostMoney(locale, row.value)} · {row.qty}
        </AppText>
      </CostPressableRow>
    </DealerBoard>
  );
}
