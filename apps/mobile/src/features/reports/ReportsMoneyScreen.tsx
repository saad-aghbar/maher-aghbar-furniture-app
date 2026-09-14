import { useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { CostFilterSheet } from './components/CostFilterSheet';
import { CostPressableRow } from './components/CostPressableRow';
import { ReportsDeskHeader } from './components/ReportsDeskHeader';
import { ReportsFilterBar } from './components/ReportsFilterBar';
import { ReportsMoneyBoard } from './components/ReportsMoneyBoard';
import { formatCostMoney } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useCostFilterChrome } from './useCostFilterChrome';
import { useReportsPeriod } from './reportsPeriod';
import { useCostMoneyQuery, useLaborActualsQuery, useLaborRatesQuery } from './query';

export function ReportsMoneyScreen() {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const scrollPad = useCostFloorScrollPad();
  const { range, dateBasis } = useReportsPeriod();
  const chrome = useCostFilterChrome('money');
  const query = useCostMoneyQuery(range, dateBasis, chrome.filter, true);
  const laborRatesQuery = useLaborRatesQuery(true);
  const laborActualsQuery = useLaborActualsQuery(range, true);
  const [explain, setExplain] = useState<string | null>(null);

  const chips = [
    chrome.filter.customerId
      ? { key: 'customerId' as const, label: chrome.dealerLabel }
      : null,
    chrome.filter.productId
      ? { key: 'productId' as const, label: chrome.productLabel }
      : null,
    chrome.filter.status
      ? { key: 'status' as const, label: t(`mobile.reports.status.${chrome.filter.status}`) }
      : null,
    chrome.filter.coverage
      ? { key: 'coverage' as const, label: t(`mobile.reports.coverage.${chrome.filter.coverage}`) }
      : null,
  ].filter(Boolean) as Array<{
    key: 'customerId' | 'productId' | 'status' | 'coverage';
    label: string;
  }>;

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={Boolean(query.isFetching && !query.isLoading)}
            onRefresh={() => {
              void query.refetch();
              void laborRatesQuery.refetch();
              void laborActualsQuery.refetch();
            }}
          />
        }
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: scrollPad,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ReportsDeskHeader desk="money">
          <ReportsFilterBar
            filter={chrome.filter}
            chips={chips}
            onOpen={chrome.openFilters}
            onClear={chrome.reset}
            onRemove={(key) => chrome.setFilter({ ...chrome.filter, [key]: null })}
          />
        </ReportsDeskHeader>

        {query.isError ? (
          <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
        ) : null}

        {query.isLoading && !query.data ? (
          <DealerBoard title={t('mobile.reports.factoryMoney')} titleWeight={titleWeight}>
            <AppText color="muted">{t('common.loading')}</AppText>
          </DealerBoard>
        ) : null}

        {query.data ? (
          <ListItemEnter index={0}>
            <ReportsMoneyBoard
              data={query.data}
              from={range.from}
              to={range.to}
              dateBasis={dateBasis}
              onExplain={setExplain}
            />
          </ListItemEnter>
        ) : null}

        <ListItemEnter index={1}>
          <DealerBoard title={t('mobile.reports.laborByWorker')} titleWeight={titleWeight}>
            {(laborActualsQuery.data?.byWorker ?? []).length ? (
              <View style={{ gap: theme.spacing.sm }}>
                {(laborActualsQuery.data?.byWorker ?? []).map((row) => (
                  <CostPressableRow
                    key={row.userId}
                    testID={`cost-labor-worker-${row.userId}`}
                    accessibilityLabel={row.name}
                    onPress={() => router.push('/(app)/(admin)/users' as Href)}
                  >
                    <AppText weight={titleWeight}>{row.name}</AppText>
                    <AppText variant="caption" dir="ltr">
                      {row.actual == null
                        ? t('mobile.reports.laborRateMissing')
                        : formatCostMoney(locale, row.actual)}
                      {row.minutes ? ` · ${(row.minutes / 60).toFixed(1)} h` : ''}
                    </AppText>
                  </CostPressableRow>
                ))}
              </View>
            ) : (
              <DealerEmptyPanel nested compact text={t('mobile.reports.noLaborActuals')} />
            )}
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={2}>
          <DealerBoard title={t('mobile.reports.laborRates')} titleWeight={titleWeight}>
            {(laborRatesQuery.data ?? []).filter((row) => row.userId && !row.effectiveTo).length ? (
              <View style={{ gap: theme.spacing.sm }}>
                {(laborRatesQuery.data ?? [])
                  .filter((row) => row.userId && !row.effectiveTo)
                  .map((row) => {
                    const name = row.user
                      ? `${row.user.firstName} ${row.user.lastName}`.trim()
                      : row.userId;
                    const label = name?.trim() || row.id;
                    return (
                      <CostPressableRow
                        key={row.id}
                        testID={`cost-labor-rate-${row.id}`}
                        accessibilityLabel={label}
                        onPress={() => router.push('/(app)/(admin)/users' as Href)}
                      >
                        <AppText weight={titleWeight}>{name}</AppText>
                        <AppText variant="caption" dir="ltr">
                          {formatCostMoney(locale, Number(row.hourlyRate))}
                        </AppText>
                      </CostPressableRow>
                    );
                  })}
              </View>
            ) : (
              <DealerEmptyPanel nested compact text={t('mobile.reports.noWorkerRates')} />
            )}
          </DealerBoard>
        </ListItemEnter>
      </ScrollView>

      <CostFilterSheet
        open={chrome.filterOpen}
        desk="money"
        onClose={() => chrome.setFilterOpen(false)}
        value={chrome.draft}
        onChange={chrome.setDraft}
        onApply={chrome.apply}
        onReset={chrome.reset}
        dealers={chrome.dealerOptions}
        products={chrome.productOptions}
      />
      <BottomSheet
        open={Boolean(explain)}
        onClose={() => setExplain(null)}
        title={t('mobile.reports.marginIncomplete')}
        fitContent
      >
        <AppText>{t('mobile.reports.marginIncompleteHint')}</AppText>
      </BottomSheet>
    </AppScreen>
  );
}
