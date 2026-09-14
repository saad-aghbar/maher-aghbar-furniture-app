import { ScrollView, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { CostPressableRow } from './components/CostPressableRow';
import { ReportsDeskHeader } from './components/ReportsDeskHeader';
import { formatCostPercent } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useReportsPeriod } from './reportsPeriod';
import { coverageIssuesHref } from './reportsDeskHrefs';
import { useCostCoverageQuery, useCoverageBackfillMutation } from './query';

const METRICS: Array<{ key: string; type: string; label: string }> = [
  { key: 'ordersFullyCostedPct', type: 'incomplete_orders', label: 'mobile.reports.coverageOrders' },
  { key: 'materialCoveragePct', type: 'partial', label: 'mobile.reports.coverageMaterials' },
  { key: 'fabricCoveragePct', type: 'fabric', label: 'mobile.reports.coverageFabric' },
  { key: 'laborTimeCoveragePct', type: 'labor_time', label: 'mobile.reports.coverageLaborTime' },
  { key: 'laborPriceCoveragePct', type: 'labor_price', label: 'mobile.reports.coverageLaborPrice' },
  { key: 'valuationCoveragePct', type: 'inventory_valuation', label: 'mobile.reports.coverageInventory' },
];

const EXTRA_ISSUES = [
  { type: 'unpriced_issues', label: 'mobile.reports.issue.unpriced_issues' },
  { type: 'unpriced_skus', label: 'mobile.reports.issue.unpriced_skus' },
  { type: 'unattributed_txs', label: 'mobile.reports.issue.unattributed_txs' },
] as const;

export function ReportsCoverageScreen() {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range, dateBasis } = useReportsPeriod();
  const scrollPad = useCostFloorScrollPad();
  const query = useCostCoverageQuery(true, range, dateBasis);
  const backfill = useCoverageBackfillMutation();
  const data = query.data;

  const affectedOf = (type: string) => {
    if (data?.affected?.[type] != null) return data.affected[type] ?? 0;
    if (type === 'unlinked_lines') return data?.unlinkedLines ?? 0;
    if (type === 'unpriced_skus' || type === 'inventory_valuation') return data?.unpriced?.length ?? 0;
    return 0;
  };

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
            onRefresh={() => void query.refetch()}
          />
        }
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: scrollPad, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <ReportsDeskHeader desk="coverage" />
        {query.isError ? (
          <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
        ) : null}
        <ListItemEnter index={0}>
          <DealerBoard title={t('mobile.reports.tabs.coverage')} titleWeight={titleWeight}>
            {query.isLoading && !data ? (
              <AppText color="muted">{t('common.loading')}</AppText>
            ) : data ? (
              <View style={{ gap: theme.spacing.sm }}>
                {METRICS.map((metric) => {
                  const raw = (data as unknown as Record<string, unknown>)[metric.key];
                  const pct = typeof raw === 'number' ? raw : null;
                  const affected = affectedOf(metric.type);
                  return (
                    <CostPressableRow
                      key={metric.key}
                      testID={`cost-coverage-${metric.type}`}
                      accessibilityLabel={t(metric.label)}
                      onPress={() =>
                        router.push(
                          coverageIssuesHref(metric.type, {
                            from: range.from,
                            to: range.to,
                            dateBasis,
                          }),
                        )
                      }
                    >
                      <AppText variant="title" weight={titleWeight} dir="ltr">
                        {formatCostPercent(locale, pct)}
                      </AppText>
                      <AppText weight={titleWeight}>{t(metric.label)}</AppText>
                      <AppText variant="caption" color="muted">
                        {t(`mobile.reports.issueExplain.${metric.type}`)}
                      </AppText>
                      <AppText variant="caption" color="muted">
                        {t('mobile.reports.coverageRecords', { n: affected })} ·{' '}
                        {t('mobile.reports.coverageReview', { n: affected })}
                      </AppText>
                    </CostPressableRow>
                  );
                })}
                <CostPressableRow
                  accessibilityLabel={t('mobile.reports.unlinkedLines')}
                  onPress={() =>
                    router.push(
                      coverageIssuesHref('unlinked_lines', {
                        from: range.from,
                        to: range.to,
                        dateBasis,
                      }),
                    )
                  }
                >
                  <AppText>{t('mobile.reports.unlinkedLines')}</AppText>
                  <AppText variant="caption" color="muted">
                    {t(`mobile.reports.issueExplain.unlinked_lines`)}
                  </AppText>
                  <AppText dir="ltr">
                    {t('mobile.reports.coverageReview', { n: affectedOf('unlinked_lines') })}
                  </AppText>
                </CostPressableRow>
                {EXTRA_ISSUES.map((issue) => (
                  <CostPressableRow
                    key={issue.type}
                    accessibilityLabel={t(issue.label)}
                    onPress={() =>
                      router.push(
                        coverageIssuesHref(issue.type, {
                          from: range.from,
                          to: range.to,
                          dateBasis,
                        }),
                      )
                    }
                  >
                    <AppText>{t(issue.label)}</AppText>
                    <AppText variant="caption" color="muted">
                      {t(`mobile.reports.issueExplain.${issue.type}`)}
                    </AppText>
                    <AppText dir="ltr">
                      {t('mobile.reports.coverageReview', { n: affectedOf(issue.type) })}
                    </AppText>
                  </CostPressableRow>
                ))}
              </View>
            ) : (
              <DealerEmptyPanel nested compact text={t('accounting.noData')} />
            )}
          </DealerBoard>
        </ListItemEnter>
        <ListItemEnter index={1}>
          <DealerBoard title={t('mobile.reports.catalogStandardCost')} titleWeight={titleWeight}>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="caption" color="muted">
                {t('mobile.reports.backfillHint')}
              </AppText>
              <PrimaryButton
                label={t('mobile.reports.backfill')}
                loading={backfill.isPending}
                onPress={() => void backfill.mutateAsync()}
              />
            </View>
          </DealerBoard>
        </ListItemEnter>
      </ScrollView>
    </AppScreen>
  );
}
