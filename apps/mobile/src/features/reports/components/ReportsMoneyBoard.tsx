import { View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { CostMoneyLine } from './CostMoneyLine';
import { CostPressableRow } from './CostPressableRow';
import { formatCostMoney, formatCostPercent } from '../costFormat';
import { coverageIssuesHref, ordersDeskHref, reportsDeskHref } from '../reportsDeskHrefs';
import type { CostDateBasis } from '../reportsPeriod';
import type { CostMoneyDesk } from '@/api/modules/reports';

type Props = {
  data: CostMoneyDesk;
  from: string;
  to: string;
  dateBasis: CostDateBasis;
  onExplain: (token: string) => void;
};

const MIX_KEYS = ['materials', 'fabric', 'labor', 'waste', 'rework'] as const;

export function ReportsMoneyBoard({ data, from, to, dateBasis, onExplain }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const perf = data.orderPerformance;
  const mix = data.costMix;
  const activity = data.factoryActivity;
  const mixTotal =
    (mix.materials ?? 0) + (mix.fabric ?? 0) + (mix.labor ?? 0) + (mix.waste ?? 0) + (mix.rework ?? 0);
  const period = { from, to, dateBasis };

  const goOrders = (extra?: Record<string, string>) =>
    router.push(ordersDeskHref({ from, to, dateBasis, ...extra }));

  if (perf.empty) {
    return (
      <DealerBoard title={t('mobile.reports.factoryMoney')} titleWeight={titleWeight}>
        <DealerEmptyPanel nested compact text={t('mobile.reports.noCompletedOrders')} />
      </DealerBoard>
    );
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <DealerBoard title={t('mobile.reports.factoryMoney')} titleWeight={titleWeight}>
        <View style={{ gap: theme.spacing.md }}>
          <CostPressableRow
            testID="cost-tile-revenue"
            accessibilityLabel={t('accounting.saleValue')}
            onPress={() => goOrders()}
          >
            <AppText variant="caption" color="muted">
              {t('accounting.saleValue')}
            </AppText>
            <AppText variant="title" weight={titleWeight} dir="ltr">
              {formatCostMoney(locale, perf.saleValue)}
            </AppText>
          </CostPressableRow>
          <CostPressableRow
            testID="cost-tile-actual"
            accessibilityLabel={t('mobile.reports.actualProduction')}
            onPress={() => goOrders()}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.reports.actualProduction')}
            </AppText>
            <AppText weight={titleWeight} dir="ltr" style={{ color: colors.textSecondary }}>
              {formatCostMoney(locale, perf.actualProductionCost)}
            </AppText>
            <AppText variant="caption" color="muted">
              {perf.complete
                ? t('mobile.reports.fullyCosted', { pct: formatCostPercent(locale, perf.coveragePct) })
                : t('mobile.reports.partiallyCostedPct', {
                    pct: formatCostPercent(locale, perf.coveragePct),
                  })}
            </AppText>
          </CostPressableRow>
          <CostPressableRow
            testID="cost-tile-margin"
            accessibilityLabel={t('accounting.grossMargin')}
            onPress={() => {
              if (perf.marginIncomplete) {
                onExplain('margin_incomplete');
                return;
              }
              goOrders();
            }}
          >
            <AppText variant="caption" color="muted">
              {t('accounting.grossMargin')}
            </AppText>
            <AppText weight={titleWeight} dir="ltr">
              {perf.marginIncomplete ? t('mobile.reports.marginIncomplete') : formatCostMoney(locale, perf.grossMargin)}
            </AppText>
            <AppText variant="caption" dir="ltr" color="muted">
              {perf.marginIncomplete ? t('mobile.reports.marginIncompleteHint') : formatCostPercent(locale, perf.marginPct)}
            </AppText>
          </CostPressableRow>
        </View>
      </DealerBoard>

      <DealerBoard title={t('mobile.reports.costMix')} titleWeight={titleWeight}>
        <View style={{ gap: theme.spacing.sm }}>
          {MIX_KEYS.map((key) => {
            const value = mix[key];
            const share = mixTotal > 0 && value != null && value > 0 ? Math.max(8, (value / mixTotal) * 100) : 0;
            return (
              <View key={key} style={{ gap: 4 }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText variant="caption">{t(`mobile.reports.mix.${key}`)}</AppText>
                  <AppText variant="caption" dir="ltr">
                    {formatCostMoney(locale, value)}
                  </AppText>
                </View>
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.surfaceSecondary,
                    overflow: 'hidden',
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  }}
                >
                  <View
                    style={{
                      width: `${share}%`,
                      height: 8,
                      backgroundColor: colors.brand,
                      opacity: 0.55,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </DealerBoard>

      <DealerBoard title={t('mobile.reports.commercial')} titleWeight={titleWeight}>
        <View style={{ gap: theme.spacing.sm }}>
          <CostPressableRow accessibilityLabel={t('mobile.reports.invoiced')} onPress={() => goOrders()}>
            <CostMoneyLine muted label={t('mobile.reports.invoiced')} value={formatCostMoney(locale, perf.invoiced)} />
          </CostPressableRow>
          <CostPressableRow accessibilityLabel={t('mobile.reports.collected')} onPress={() => goOrders()}>
            <CostMoneyLine muted label={t('mobile.reports.collected')} value={formatCostMoney(locale, perf.collected)} />
          </CostPressableRow>
          <CostPressableRow accessibilityLabel={t('mobile.reports.outstanding')} onPress={() => goOrders()}>
            <CostMoneyLine muted label={t('mobile.reports.outstanding')} value={formatCostMoney(locale, perf.outstanding)} />
          </CostPressableRow>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.afterSale')}
            onPress={() => router.push(reportsDeskHref('returns'))}
          >
            <CostMoneyLine muted label={t('mobile.reports.afterSale')} value={formatCostMoney(locale, data.afterSaleCost)} />
          </CostPressableRow>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.purchaseInflow')}
            onPress={() => router.push(reportsDeskHref('inventory'))}
          >
            <CostMoneyLine muted label={t('mobile.reports.purchaseInflow')} value={formatCostMoney(locale, data.purchaseInflow)} />
          </CostPressableRow>
          <CostPressableRow
            testID="cost-tile-inventory"
            accessibilityLabel={t('mobile.reports.currentInventoryValue')}
            onPress={() => router.push(reportsDeskHref('inventory'))}
          >
            <CostMoneyLine
              muted
              label={t('mobile.reports.currentInventoryValue')}
              value={formatCostMoney(locale, data.inventoryValue)}
            />
          </CostPressableRow>
        </View>
      </DealerBoard>

      <DealerBoard title={t('mobile.reports.factoryActivity')} titleWeight={titleWeight}>
        <View style={{ gap: theme.spacing.sm }}>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.productionCostIncurred')}
            onPress={() => goOrders({ dateBasis: 'activity' })}
          >
            <CostMoneyLine
              muted
              label={t('mobile.reports.productionCostIncurred')}
              value={formatCostMoney(locale, activity.productionCostIncurred)}
            />
          </CostPressableRow>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.workerHours')}
            onPress={() => router.push('/(app)/(admin)/users' as Href)}
          >
            <CostMoneyLine
              muted
              label={t('mobile.reports.workerHours')}
              value={activity.workerHours != null ? `${activity.workerHours.toFixed(1)} h` : '—'}
            />
          </CostPressableRow>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.materialConsumption')}
            onPress={() => router.push(reportsDeskHref('inventory'))}
          >
            <CostMoneyLine
              muted
              label={t('mobile.reports.materialConsumption')}
              value={formatCostMoney(locale, activity.issues)}
            />
          </CostPressableRow>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.finishedOutput')}
            onPress={() => router.push(reportsDeskHref('inventory'))}
          >
            <CostMoneyLine
              muted
              label={t('mobile.reports.finishedOutput')}
              value={formatCostMoney(locale, activity.finishedOutput)}
            />
          </CostPressableRow>
        </View>
      </DealerBoard>

      <DealerBoard title={t('mobile.reports.attention')} titleWeight={titleWeight}>
        <View style={{ gap: theme.spacing.sm }}>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.attentionNegative')}
            onPress={() => goOrders({ marginHealth: 'negative' })}
          >
            <CostMoneyLine label={t('mobile.reports.attentionNegative')} value={String(data.attention.negativeMargin)} />
          </CostPressableRow>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.attentionPartial')}
            onPress={() => goOrders({ coverage: 'partial' })}
          >
            <CostMoneyLine label={t('mobile.reports.attentionPartial')} value={String(data.attention.partiallyCosted)} />
          </CostPressableRow>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.attentionLabor')}
            onPress={() => router.push(coverageIssuesHref('labor_price', period))}
          >
            <CostMoneyLine label={t('mobile.reports.attentionLabor')} value={String(data.attention.laborRateMissing)} />
          </CostPressableRow>
          <CostPressableRow
            accessibilityLabel={t('mobile.reports.attentionReturns')}
            onPress={() => router.push(reportsDeskHref('returns'))}
          >
            <CostMoneyLine label={t('mobile.reports.attentionReturns')} value={String(data.attention.hasReturn)} />
          </CostPressableRow>
        </View>
      </DealerBoard>
    </View>
  );
}
