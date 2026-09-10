import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScrollView, View } from 'react-native';
import { queryKeys } from '@/api/queryKeys';
import { getCostOrderDossier } from '@/api/modules/reports';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { formatCurrency } from '@/i18n/format';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';

export default function OrderCostDossierRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const query = useQuery({
    queryKey: queryKeys.reports.costDossier(String(id)),
    queryFn: () => getCostOrderDossier(String(id)),
    enabled: Boolean(id),
  });

  const money = (value: number | null | undefined) =>
    value == null ? '—' : formatCurrency(locale, value);

  return (
    <AppScreen>
      <View style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}>
        <ScreenBackLead fallback="/(app)/(admin)/reports" />
        <AppText variant="largeTitle" weight={titleWeight} align="center" numberOfLines={1}>
          {t('accounting.orderCostDossier')}
        </AppText>
      </View>
      {query.isError ? (
        <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: 32 }}>
          <ListItemEnter index={0}>
            <DealerBoard title={query.data.number} titleWeight={titleWeight}>
              <AppText>
                {t('accounting.saleValue')}: {money(query.data.summary.saleValue)}
              </AppText>
              <AppText>
                {t('accounting.actualCost')}: {money(query.data.summary.actualProductionCost)}
              </AppText>
              <AppText>
                {t('accounting.grossMargin')}: {money(query.data.summary.grossMargin)}
              </AppText>
              <AppText>
                {t('accounting.coverage')}: {query.data.summary.coverage}
              </AppText>
            </DealerBoard>
          </ListItemEnter>
          <ListItemEnter index={1}>
            <DealerBoard title={t('accounting.lensTime')} titleWeight={titleWeight}>
              <AppText>
                {t('accounting.workerEffort')}: {(query.data.time.workerEffortMinutes / 60).toFixed(1)} h
              </AppText>
              <AppText>
                {t('accounting.wallClock')}:{' '}
                {query.data.time.wallClockMinutes == null
                  ? '—'
                  : `${(query.data.time.wallClockMinutes / 60).toFixed(1)} h`}
              </AppText>
              <AppText color="muted">
                {query.data.time.labor.enabled
                  ? money(query.data.time.labor.total)
                  : t('accounting.laborHidden')}
              </AppText>
            </DealerBoard>
          </ListItemEnter>
          <ListItemEnter index={2}>
            <DealerBoard title={t('accounting.lifetimeCost')} titleWeight={titleWeight}>
              <AppText>
                {t('accounting.originalProduction')}: {money(query.data.lifetime.originalProductionCost)}
              </AppText>
              <AppText>
                {t('accounting.afterSaleReturn')}: {money(query.data.lifetime.afterSaleReturnCost)}
              </AppText>
              <AppText>
                {t('accounting.recoveredValue')}: {money(query.data.lifetime.recoveredValue)}
              </AppText>
              <AppText>
                {t('accounting.disposedValue')}: {money(query.data.lifetime.disposedValue)}
              </AppText>
            </DealerBoard>
          </ListItemEnter>
        </ScrollView>
      ) : null}
    </AppScreen>
  );
}
