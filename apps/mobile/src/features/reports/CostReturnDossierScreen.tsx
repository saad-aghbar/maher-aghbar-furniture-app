import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { formatCurrency } from '@/i18n/format';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { CostPressableRow } from './components/CostPressableRow';
import { useCostReturnDossierQuery } from './query';

const BACK_FALLBACK = '/(app)/(admin)/reports' as Href;

type Props = { id: string };

export function CostReturnDossierScreen({ id }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const query = useCostReturnDossierQuery(id);
  const data = query.data;

  const money = (value: number | null | undefined) =>
    value == null ? '—' : formatCurrency(locale, value);

  const openReturn = () => router.push(`/(app)/(admin)/returns/${id}` as Href);

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
          <ScreenBackLead fallback={BACK_FALLBACK} />
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={1}
          style={{ paddingHorizontal: theme.sizes.touch.min + theme.spacing.sm }}
        >
          {t('accounting.returnCostDossier')}
        </AppText>
      </View>

      {query.isError ? (
        <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
      ) : null}

      {query.isLoading && !data ? (
        <DealerBoard title={t('accounting.returnCostDossier')} titleWeight={titleWeight}>
          <ActivityIndicator color={colors.brand} />
        </DealerBoard>
      ) : null}

      {data ? (
        <ScrollView
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <ListItemEnter index={0}>
            <DealerBoard title={data.number} titleWeight={titleWeight}>
              <View style={{ gap: theme.spacing.sm }}>
                <CostPressableRow
                  accessibilityLabel={t('mobile.reports.openReturn')}
                  onPress={openReturn}
                >
                  <AppText weight={titleWeight}>{t('mobile.reports.openReturn')}</AppText>
                  <AppText variant="caption">{data.status ?? data.lifecycleState ?? ''}</AppText>
                </CostPressableRow>
                {data.salesOrder ? (
                  <CostPressableRow
                    accessibilityLabel={data.salesOrder.number}
                    onPress={() =>
                      router.push(`/(app)/(admin)/orders/${data.salesOrder!.id}` as Href)
                    }
                  >
                    <AppText weight={titleWeight}>{data.salesOrder.number}</AppText>
                    <AppText variant="caption">{t('mobile.reports.openOrder')}</AppText>
                  </CostPressableRow>
                ) : null}
                <AppText dir="ltr">
                  {t('accounting.repairCost')}: {money(data.repairCost)}
                </AppText>
                <AppText dir="ltr">
                  {t('accounting.replacementCost')}: {money(data.replacementCost)}
                </AppText>
                <AppText dir="ltr">
                  {t('accounting.recoveryCost')}: {money(data.recoveryCost)}
                </AppText>
                <AppText dir="ltr">
                  {t('accounting.returnGrossCost')}: {money(data.returnGrossCost)}
                </AppText>
                <AppText dir="ltr">
                  {t('accounting.recoveredValue')}: {money(data.recoveredValue)}
                </AppText>
                <AppText dir="ltr">
                  {t('accounting.disposedValue')}: {money(data.disposedValue)}
                </AppText>
              </View>
            </DealerBoard>
          </ListItemEnter>

          <ListItemEnter index={1}>
            <DealerBoard title={t('mobile.reports.pieces')} titleWeight={titleWeight}>
              {(data.pieces ?? []).length ? (
                <View style={{ gap: theme.spacing.sm }}>
                  {(data.pieces ?? []).map((piece, index) => (
                    <CostPressableRow
                      key={piece.id}
                      accessibilityLabel={piece.id}
                      onPress={openReturn}
                    >
                      <AppText weight={titleWeight}>
                        {t('mobile.reports.pieces')} {index + 1}
                      </AppText>
                      <AppText variant="caption" dir="ltr">
                        {money(piece.workCost)} · {piece.workerEffortMinutes} min
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
      ) : null}
    </AppScreen>
  );
}
