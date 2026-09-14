import { ActivityIndicator, ScrollView, View } from 'react-native';
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
import { CostMoneyLine } from './components/CostMoneyLine';
import { CostPressableRow } from './components/CostPressableRow';
import { formatCostMoney, formatCostPercent } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useReportsPeriod } from './reportsPeriod';
import { variantProfileHref } from './reportsDeskHrefs';
import { useCostProductProfileQuery } from './query';
import type { Href } from 'expo-router';

const BACK = '/(app)/(admin)/reports/products' as Href;

export function CostProductProfileScreen({ productId }: { productId: string }) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range, dateBasis } = useReportsPeriod();
  const scrollPad = useCostFloorScrollPad();
  const query = useCostProductProfileQuery(productId, range, dateBasis, true);
  const product = query.data?.product;
  const stats = query.data?.data?.[0];
  const title = localizedName(locale, product, product?.sku || t('mobile.reports.tabs.products'));
  const variants = query.data?.variants ?? [];

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
          <ScreenBackLead fallback={BACK} />
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={1}
          style={{ paddingHorizontal: theme.sizes.touch.min + theme.spacing.sm }}
        >
          {title}
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
        {product?.sku ? (
          <AppText variant="caption" color="muted" align="center" dir="ltr">
            {product.sku}
          </AppText>
        ) : null}
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
                <CostMoneyLine
                  label={t('mobile.reports.avgActual')}
                  value={formatCostMoney(locale, stats.averageActualCost)}
                />
                <CostMoneyLine
                  muted
                  label={t('mobile.reports.avgSale')}
                  value={formatCostMoney(locale, stats.averageSaleValue)}
                />
                <CostMoneyLine
                  label={t('accounting.grossMargin')}
                  value={formatCostMoney(locale, stats.averageMargin)}
                />
                <AppText variant="caption" color="muted" dir="ltr">
                  {stats.orderCount} · {stats.unitsProduced ?? 0} ·{' '}
                  {formatCostPercent(locale, (stats.returnRate ?? 0) * 100)}
                </AppText>
              </View>
            ) : (
              <DealerEmptyPanel nested compact text={t('accounting.noData')} />
            )}
          </DealerBoard>
        </ListItemEnter>
        <ListItemEnter index={2}>
          <DealerBoard title={t('mobile.reports.variantSlot')} titleWeight={titleWeight}>
            {variants.length ? (
              <View style={{ gap: theme.spacing.sm }}>
                {variants.map((row) => (
                  <CostPressableRow
                    key={row.variantId}
                    accessibilityLabel={row.variant?.sku ?? row.variantId}
                    onPress={() =>
                      router.push(
                        variantProfileHref(productId, row.variantId, {
                          from: range.from,
                          to: range.to,
                          dateBasis,
                        }),
                      )
                    }
                  >
                    <CostMoneyLine
                      label={localizedName(locale, row.variant, row.variant?.sku || row.variantId)}
                      value={formatCostMoney(locale, row.averageActualCost)}
                    />
                    <AppText variant="caption" color="muted" dir="ltr">
                      {row.variant?.sku} · {row.orderCount}
                    </AppText>
                  </CostPressableRow>
                ))}
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

export function CostProductProfileRoute() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  return <CostProductProfileScreen productId={String(productId ?? '')} />;
}
