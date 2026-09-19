import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
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
import { formatCostMoney, formatCostPercent } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useReportsPeriod } from './reportsPeriod';
import { useCostVariantProfileQuery } from './query';

export function CostVariantProfileScreen({
  productId,
  variantId,
  embedded = false,
}: {
  productId: string;
  variantId: string;
  embedded?: boolean;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range, dateBasis } = useReportsPeriod();
  const scrollPad = useCostFloorScrollPad();
  const query = useCostVariantProfileQuery(productId, variantId, range, dateBasis, true);
  const variant = query.data?.variant;
  const stats = query.data?.data?.[0] ?? query.data?.variants?.find((row) => row.variantId === variantId);
  const back = `/(app)/(admin)/reports/products/${productId}` as Href;

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
          {embedded ? null : <ScreenBackLead fallback={back} />}
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={1}
          style={{ paddingHorizontal: theme.sizes.touch.min + theme.spacing.sm }}
        >
          {localizedName(locale, variant, variant?.sku || t('mobile.reports.variantSlot'))}
        </AppText>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: scrollPad, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
      {query.isError ? (
        <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
      ) : null}
      {query.isLoading && !query.data ? <ActivityIndicator color={colors.brand} /> : null}
        <ListItemEnter index={0}>
          <DealerBoard title={t('mobile.reports.plannedBaseline')} titleWeight={titleWeight}>
            <AppText dir="ltr">{formatCostMoney(locale, query.data?.plannedBaseline ?? null)}</AppText>
            <AppText variant="caption" color="muted">
              {t('mobile.reports.plannedBaselineHint')}
            </AppText>
          </DealerBoard>
        </ListItemEnter>
        <ListItemEnter index={1}>
          <DealerBoard title={t('mobile.reports.periodPerformance')} titleWeight={titleWeight}>
            {stats ? (
              <View style={{ gap: theme.spacing.sm }}>
                <AppText dir="ltr">
                  {t('mobile.reports.avgActual')}: {formatCostMoney(locale, stats.averageActualCost)}
                </AppText>
                {'averageSaleValue' in stats ? (
                  <AppText dir="ltr">
                    {t('mobile.reports.avgSale')}: {formatCostMoney(locale, stats.averageSaleValue)}
                  </AppText>
                ) : null}
                {'averageMargin' in stats ? (
                  <AppText dir="ltr">
                    {t('accounting.grossMargin')}: {formatCostMoney(locale, stats.averageMargin)}
                  </AppText>
                ) : null}
                <AppText variant="caption" dir="ltr">
                  {stats.orderCount}
                  {'unitsProduced' in stats && stats.unitsProduced != null ? ` · ${stats.unitsProduced}` : ''}
                  {'returnRate' in stats && stats.returnRate != null
                    ? ` · ${formatCostPercent(locale, stats.returnRate * 100)}`
                    : ''}
                </AppText>
              </View>
            ) : (
              <DealerEmptyPanel nested compact text={t('accounting.noData')} />
            )}
          </DealerBoard>
        </ListItemEnter>
      </ScrollView>
    </AppScreen>
  );
}

export function CostVariantProfileRoute() {
  const { productId, variantId } = useLocalSearchParams<{ productId: string; variantId: string }>();
  return (
    <CostVariantProfileScreen
      productId={String(productId ?? '')}
      variantId={String(variantId ?? '')}
    />
  );
}
