import { ActivityIndicator, FlatList, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { CostPressableRow } from './components/CostPressableRow';
import { formatCostMoney } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useReportsPeriod } from './reportsPeriod';
import { orderDossierHref } from './reportsDeskHrefs';
import { useCostCustomWorkQuery } from './query';

const BACK = '/(app)/(admin)/reports/products' as Href;

export function CostCustomWorkScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range, dateBasis } = useReportsPeriod();
  const scrollPad = useCostFloorScrollPad();
  const query = useCostCustomWorkQuery(range, dateBasis, true);
  const rows = query.data?.data ?? [];

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
          style={{ paddingHorizontal: theme.sizes.touch.min + theme.spacing.sm }}
        >
          {t('mobile.reports.customWork')}
        </AppText>
      </View>
      {query.isError ? (
        <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: scrollPad, flexGrow: 1 }}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <DealerEmptyPanel text={t('mobile.reports.noCustomWork')} />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <DealerBoard title={item.number} titleWeight={titleWeight}>
              <CostPressableRow
                accessibilityLabel={item.number}
                onPress={() =>
                  router.push(orderDossierHref(item.id, { from: range.from, to: range.to, dateBasis }))
                }
              >
                <AppText>{item.productSummary}</AppText>
                <AppText variant="caption" dir="ltr">
                  {formatCostMoney(locale, item.actualCost)}
                </AppText>
              </CostPressableRow>
            </DealerBoard>
          </ListItemEnter>
        )}
      />
    </AppScreen>
  );
}
