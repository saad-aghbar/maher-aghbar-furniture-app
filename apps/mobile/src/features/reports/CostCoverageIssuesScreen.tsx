import { ActivityIndicator, FlatList, View } from 'react-native';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { localizedName } from '@maher/i18n';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { CostPressableRow } from './components/CostPressableRow';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useReportsPeriod } from './reportsPeriod';
import { inventoryItemHref, orderDossierHref, returnDossierHref } from './reportsDeskHrefs';
import { useCostCoverageIssuesQuery } from './query';

const BACK = '/(app)/(admin)/reports/coverage' as Href;

type IssueRec = {
  id?: string;
  orderId?: string;
  number?: string;
  sku?: string;
  description?: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
};

function issueHref(
  type: string,
  rec: IssueRec,
  period: { from: string; to: string; dateBasis: 'delivered' | 'activity' | 'orderDate' },
): Href | null {
  if ((type === 'unpriced_skus' || type === 'inventory_valuation') && rec.id) {
    return inventoryItemHref(rec.id, period);
  }
  if (type === 'unlinked_lines' && rec.orderId) {
    return orderDossierHref(rec.orderId, period);
  }
  const number = String(rec.number ?? '');
  if (rec.id && (number.startsWith('RT-') || number.startsWith('RET-'))) {
    return returnDossierHref(rec.id, period);
  }
  if (rec.id && (number.startsWith('SO-') || type === 'incomplete_orders' || type === 'partial' || type === 'labor_price' || type === 'labor_time' || type === 'fabric' || type === 'unpriced_issues')) {
    return orderDossierHref(rec.id, period);
  }
  return null;
}

export function CostCoverageIssuesScreen({
  issueType,
  embedded = false,
}: {
  issueType: string;
  embedded?: boolean;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range, dateBasis } = useReportsPeriod();
  const scrollPad = useCostFloorScrollPad();
  const query = useCostCoverageIssuesQuery(issueType, range, dateBasis, true);
  const rows = query.data?.data ?? [];
  const period = { from: range.from, to: range.to, dateBasis };

  return (
    <AppScreen>
      <View style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            zIndex: 1,
            justifyContent: 'center',
          }}
        >
          {embedded ? null : <ScreenBackLead fallback={BACK} />}
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={2}
          style={{ paddingHorizontal: theme.sizes.touch.min + theme.spacing.sm }}
        >
          {t(`mobile.reports.issue.${issueType}`)}
        </AppText>
      </View>
      <AppText variant="caption" color="muted" align="center" style={{ paddingHorizontal: theme.spacing.lg }}>
        {t(`mobile.reports.issueExplain.${issueType}`)}
      </AppText>
      {query.isError ? (
        <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(row, index) => String((row as IssueRec).id ?? (row as IssueRec).number ?? index)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: scrollPad, flexGrow: 1 }}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <DealerEmptyPanel text={t('accounting.noData')} />
          )
        }
        renderItem={({ item, index }) => {
          const rec = item as IssueRec;
          const name = localizedName(locale, rec, '');
          const label =
            rec.number || rec.sku || rec.description || name || rec.id || t('mobile.reports.historicalCostUnavailable');
          const href = issueHref(issueType, rec, period);
          return (
            <ListItemEnter index={index}>
              <DealerBoard title={label} titleWeight={titleWeight}>
                {href ? (
                  <CostPressableRow
                    accessibilityLabel={label}
                    onPress={() => router.push(href)}
                  >
                    <AppText>{label}</AppText>
                    {rec.sku && rec.number ? (
                      <AppText variant="caption" color="muted" dir="ltr">
                        {rec.sku}
                      </AppText>
                    ) : null}
                  </CostPressableRow>
                ) : (
                  <AppText>{label}</AppText>
                )}
              </DealerBoard>
            </ListItemEnter>
          );
        }}
      />
    </AppScreen>
  );
}

export function CostCoverageIssuesRoute() {
  const { issueType } = useLocalSearchParams<{ issueType: string }>();
  return <CostCoverageIssuesScreen issueType={String(issueType ?? 'incomplete_orders')} />;
}
