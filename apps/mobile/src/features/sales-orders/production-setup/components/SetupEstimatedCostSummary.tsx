import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type {
  SetupActualCostSummary as ActualSummary,
  SetupEstimatedCostSummary as CostSummary,
} from '../../api';
import {
  OrderBoardCard,
  OrderSectionHeader,
} from '../../components/OrderBoardCard';

type Props = {
  summary?: CostSummary | null;
  actual?: ActualSummary | null;
};

const ROWS = [
  {
    key: 'fabric',
    labelKey: 'mobile.orderDetail.fabricCost',
    qtyKey: 'fabricQty' as const,
    costKey: 'fabricCost' as const,
  },
  {
    key: 'wood',
    labelKey: 'mobile.orderDetail.woodCost',
    qtyKey: 'woodQty' as const,
    costKey: 'woodCost' as const,
  },
  {
    key: 'foam',
    labelKey: 'mobile.orderDetail.foamCost',
    qtyKey: 'foamQty' as const,
    costKey: 'foamCost' as const,
  },
  {
    key: 'accessories',
    labelKey: 'mobile.orderDetail.accessoriesCost',
    qtyKey: 'accessoriesQty' as const,
    costKey: 'accessoriesCost' as const,
  },
  {
    key: 'other',
    labelKey: 'mobile.productionSetup.cost.other',
    qtyKey: 'otherQty' as const,
    costKey: 'otherCost' as const,
  },
] as const;

export function SetupEstimatedCostSummary({ summary, actual }: Props) {
  const { t, formatCurrency, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  if (!summary && !actual) return null;

  const costAvailable = summary?.costAvailable ?? false;
  const total =
    costAvailable && summary?.totalEstimated != null ? summary.totalEstimated : null;
  const incomplete =
    summary?.estimateIncomplete ||
    summary?.incomplete ||
    summary?.someCostsUnavailable;
  const actualTotal =
    actual?.costAvailable && actual.totalActual != null ? actual.totalActual : null;

  return (
    <OrderBoardCard accent={colors.brand}>
      <OrderSectionHeader
        icon="hammer-outline"
        label={t('mobile.productionSetup.sections.cost')}
        accent={colors.brand}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ gap: 2 }}>
          <AppText variant="caption" color="muted">
            {t('mobile.productionSetup.cost.estimated')}
          </AppText>
          <AppText variant="title" weight="semibold" dir="ltr">
            {total != null
              ? formatCurrency(total)
              : t('mobile.productionSetup.cost.unavailable')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('mobile.productionSetup.cost.plannedNote')}
          </AppText>
        </View>

        {incomplete ? (
          <AppText variant="caption" style={{ color: colors.warning }}>
            {t('mobile.productionSetup.cost.incomplete')}
          </AppText>
        ) : null}

        {actual ? (
          <View style={{ gap: 2, marginTop: theme.spacing.sm }}>
            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.cost.actual')}
            </AppText>
            <AppText variant="label" weight="semibold" dir="ltr">
              {actualTotal != null
                ? formatCurrency(actualTotal)
                : t('mobile.productionSetup.cost.unavailable')}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.cost.actualNote')}
            </AppText>
          </View>
        ) : null}
      </View>

      {summary ? (
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          {ROWS.map((row) => {
            const qty = summary[row.qtyKey];
            const cost = summary[row.costKey];
            if (qty <= 0 && (!costAvailable || cost <= 0)) return null;
            return (
              <View
                key={row.key}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.md,
                  gap: 4,
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <AppText
                  variant="caption"
                  color="muted"
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    fontSize: 11,
                  }}
                >
                  {t(row.labelKey)}
                </AppText>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText variant="caption" color="secondary" dir="ltr">
                    {t('mobile.productionSetup.quantity')}: {qty}
                  </AppText>
                  <AppText variant="label" weight="semibold" dir="ltr">
                    {costAvailable && cost > 0
                      ? formatCurrency(cost)
                      : t('mobile.productionSetup.cost.unavailable')}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </OrderBoardCard>
  );
}
