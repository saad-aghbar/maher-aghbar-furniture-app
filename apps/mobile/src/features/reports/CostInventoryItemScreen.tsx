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
import { formatCostMoney } from './costFormat';
import { provenanceLabelKey } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useReportsPeriod } from './reportsPeriod';
import { useCostInventoryItemQuery } from './query';

const BACK = '/(app)/(admin)/reports/inventory' as Href;

export function CostInventoryItemScreen({
  itemId,
  embedded = false,
}: {
  itemId: string;
  embedded?: boolean;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range } = useReportsPeriod();
  const scrollPad = useCostFloorScrollPad();
  const query = useCostInventoryItemQuery(itemId, range, true);
  const data = query.data;

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
          numberOfLines={1}
          dir="ltr"
          style={{ paddingHorizontal: theme.sizes.touch.min + theme.spacing.sm }}
        >
          {data?.sku || t('mobile.reports.tabs.inventory')}
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
      {query.isLoading && !data ? <ActivityIndicator color={colors.brand} /> : null}
      {data ? (
        <>
          <ListItemEnter index={0}>
            <DealerBoard title={t('mobile.reports.currentInventoryValue')} titleWeight={titleWeight}>
              <AppText dir="ltr">{formatCostMoney(locale, data.value)}</AppText>
              <AppText variant="caption">{localizedName(locale, data, data.sku)}</AppText>
              <AppText variant="caption" dir="ltr">
                {data.qty} · {formatCostMoney(locale, data.costBasis)}
              </AppText>
            </DealerBoard>
          </ListItemEnter>
          <ListItemEnter index={1}>
            <DealerBoard title={t('mobile.reports.inventoryFlow')} titleWeight={titleWeight}>
              {data.ledger.length ? (
                <View style={{ gap: theme.spacing.sm }}>
                  {data.ledger.map((row) => (
                    <View key={row.id} style={{ gap: 2 }}>
                      <AppText weight={titleWeight} dir="ltr">
                        {row.number}
                      </AppText>
                      <AppText variant="caption">{t(provenanceLabelKey(row.type))}</AppText>
                      <AppText variant="caption" dir="ltr">
                        {row.qty} · {formatCostMoney(locale, row.value)}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : (
                <DealerEmptyPanel nested compact text={t('accounting.noData')} />
              )}
            </DealerBoard>
          </ListItemEnter>
        </>
      ) : null}
      </ScrollView>
    </AppScreen>
  );
}

export function CostInventoryItemRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  return <CostInventoryItemScreen itemId={String(itemId ?? '')} />;
}
