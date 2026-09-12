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
import { CostNotConfiguredSlot } from './components/CostNotConfiguredSlot';
import { CostPressableRow } from './components/CostPressableRow';
import { useCostOrderDossierQuery } from './query';

const BACK_FALLBACK = '/(app)/(admin)/reports' as Href;

type Props = { id: string };

export function CostOrderDossierScreen({ id }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const query = useCostOrderDossierQuery(id);

  const money = (value: number | null | undefined) =>
    value == null ? '—' : formatCurrency(locale, value);

  const openOrder = () => router.push(`/(app)/(admin)/orders/${id}` as Href);

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
          {t('accounting.orderCostDossier')}
        </AppText>
      </View>

      {query.isError ? (
        <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
      ) : null}

      {query.isLoading && !query.data ? (
        <DealerBoard title={t('accounting.orderCostDossier')} titleWeight={titleWeight}>
          <ActivityIndicator color={colors.brand} />
        </DealerBoard>
      ) : null}

      {query.data ? (
        <ScrollView
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <ListItemEnter index={0}>
            <DealerBoard title={query.data.number} titleWeight={titleWeight}>
              <View style={{ gap: theme.spacing.sm }}>
                <CostPressableRow
                  accessibilityLabel={t('mobile.reports.openOrder')}
                  onPress={openOrder}
                >
                  <AppText weight={titleWeight}>{t('mobile.reports.openOrder')}</AppText>
                  <AppText variant="caption" color="muted">
                    {query.data.status ?? ''}
                  </AppText>
                </CostPressableRow>
                <AppText dir="ltr">
                  {t('accounting.saleValue')}: {money(query.data.summary.saleValue)}
                </AppText>
                <AppText dir="ltr">
                  {t('accounting.plannedCost')}: {money(query.data.summary.plannedCost)}
                </AppText>
                <AppText dir="ltr">
                  {t('accounting.actualCost')}: {money(query.data.summary.actualProductionCost)}
                </AppText>
                <AppText dir="ltr">
                  {t('accounting.variance')}: {money(query.data.summary.variance)}
                </AppText>
                <AppText dir="ltr">
                  {t('accounting.grossMargin')}: {money(query.data.summary.grossMargin)}
                </AppText>
                <AppText>
                  {t('accounting.coverage')}: {query.data.summary.coverage}
                </AppText>
              </View>
            </DealerBoard>
          </ListItemEnter>

          <ListItemEnter index={1}>
            <DealerBoard title={t('mobile.reports.orderLines')} titleWeight={titleWeight}>
              {(query.data.lines ?? []).length ? (
                <View style={{ gap: theme.spacing.sm }}>
                  {(query.data.lines ?? []).map((line) => (
                    <CostPressableRow
                      key={line.id}
                      accessibilityLabel={line.description || line.sku || line.id}
                      onPress={openOrder}
                    >
                      <AppText weight={titleWeight}>{line.description || line.sku || line.id}</AppText>
                      <AppText variant="caption" dir="ltr">
                        {line.quantity} · {money(line.actualCost)}
                      </AppText>
                    </CostPressableRow>
                  ))}
                </View>
              ) : (
                <DealerEmptyPanel nested compact text={t('accounting.noData')} />
              )}
            </DealerBoard>
          </ListItemEnter>

          <ListItemEnter index={2}>
            <DealerBoard title={t('mobile.reports.materials')} titleWeight={titleWeight}>
              {(query.data.materials?.rows ?? []).length ? (
                <View style={{ gap: theme.spacing.sm }}>
                  {(query.data.materials?.rows ?? []).map((row) => (
                    <CostPressableRow
                      key={row.inventoryItemId ?? row.sku}
                      accessibilityLabel={row.sku}
                      onPress={() => {
                        if (row.inventoryItemId) {
                          router.push(
                            `/(app)/(admin)/inventory/items/${row.inventoryItemId}` as Href,
                          );
                          return;
                        }
                        openOrder();
                      }}
                    >
                      <AppText weight={titleWeight} dir="ltr">
                        {row.sku}
                      </AppText>
                      <AppText variant="caption" dir="ltr">
                        {row.netQty} · {money(row.actualCost)}
                      </AppText>
                    </CostPressableRow>
                  ))}
                </View>
              ) : (
                <DealerEmptyPanel nested compact text={t('accounting.noData')} />
              )}
            </DealerBoard>
          </ListItemEnter>

          <ListItemEnter index={3}>
            <DealerBoard title={t('accounting.lensTime')} titleWeight={titleWeight}>
              <View style={{ gap: theme.spacing.sm }}>
                <AppText>
                  {t('accounting.workerEffort')}:{' '}
                  {(query.data.time.workerEffortMinutes / 60).toFixed(1)} h
                </AppText>
                <AppText>
                  {t('accounting.wallClock')}:{' '}
                  {query.data.time.wallClockMinutes == null
                    ? '—'
                    : `${(query.data.time.wallClockMinutes / 60).toFixed(1)} h`}
                </AppText>
                {(query.data.time.byStage ?? []).map((stage) => (
                  <CostPressableRow
                    key={stage.stageCode ?? 'stage'}
                    accessibilityLabel={stage.stageCode ?? t('mobile.reports.timeByStage')}
                    onPress={openOrder}
                  >
                    <AppText weight={titleWeight}>{stage.stageCode ?? '—'}</AppText>
                    <AppText variant="caption" dir="ltr">
                      {(stage.minutes / 60).toFixed(1)} h
                    </AppText>
                  </CostPressableRow>
                ))}
              </View>
            </DealerBoard>
          </ListItemEnter>

          <ListItemEnter index={4}>
            {query.data.time.labor.enabled || query.data.summary.labor != null ? (
              <DealerBoard title={t('mobile.reports.laborSlot')} titleWeight={titleWeight}>
                <View style={{ gap: theme.spacing.sm }}>
                  <CostPressableRow
                    testID="cost-labor-total"
                    accessibilityLabel={t('accounting.laborCost')}
                    onPress={openOrder}
                  >
                    <AppText weight={titleWeight}>{t('accounting.laborCost')}</AppText>
                    <AppText dir="ltr">
                      {money(query.data.summary.labor ?? query.data.time.labor.total)}
                    </AppText>
                  </CostPressableRow>
                  {(query.data.time.labor.byWorker ?? []).map((row) => (
                    <CostPressableRow
                      key={row.userId}
                      testID={`cost-labor-worker-${row.userId}`}
                      accessibilityLabel={row.userId}
                      onPress={() => router.push('/(app)/(admin)/users' as Href)}
                    >
                      <AppText weight={titleWeight}>{row.userId}</AppText>
                      <AppText variant="caption" dir="ltr">
                        {row.actual == null ? t('mobile.reports.notConfigured') : money(row.actual)}
                        {row.minutes ? ` · ${(row.minutes / 60).toFixed(1)} h` : ''}
                      </AppText>
                    </CostPressableRow>
                  ))}
                </View>
              </DealerBoard>
            ) : (
              <CostNotConfiguredSlot
                title={t('mobile.reports.laborSlot')}
                hint={t('mobile.reports.laborSlotHint')}
              />
            )}
          </ListItemEnter>

          <ListItemEnter index={5}>
            <DealerBoard title={t('mobile.reports.linkedReturns')} titleWeight={titleWeight}>
              {(query.data.returns ?? []).length ? (
                <View style={{ gap: theme.spacing.sm }}>
                  {(query.data.returns ?? []).map((row) => (
                    <CostPressableRow
                      key={row.id}
                      accessibilityLabel={row.number}
                      onPress={() =>
                        router.push(`/(app)/(admin)/reports/returns/${row.id}` as Href)
                      }
                    >
                      <AppText weight={titleWeight}>{row.number}</AppText>
                      <AppText variant="caption">{row.lifecycleState}</AppText>
                    </CostPressableRow>
                  ))}
                </View>
              ) : (
                <DealerEmptyPanel nested compact text={t('accounting.noData')} />
              )}
            </DealerBoard>
          </ListItemEnter>

          <ListItemEnter index={6}>
            <DealerBoard title={t('mobile.reports.transactions')} titleWeight={titleWeight}>
              {(query.data.provenance?.transactions ?? []).length ? (
                <View style={{ gap: theme.spacing.sm }}>
                  {(query.data.provenance?.transactions ?? []).map((tx) => (
                    <CostPressableRow
                      key={tx.id}
                      accessibilityLabel={tx.number || tx.sku}
                      onPress={openOrder}
                    >
                      <AppText weight={titleWeight} dir="ltr">
                        {tx.number} · {tx.sku}
                      </AppText>
                      <AppText variant="caption" dir="ltr">
                        {tx.type} · {money(tx.unitCost)}
                      </AppText>
                    </CostPressableRow>
                  ))}
                </View>
              ) : (
                <DealerEmptyPanel nested compact text={t('accounting.noData')} />
              )}
            </DealerBoard>
          </ListItemEnter>

          <ListItemEnter index={7}>
            <DealerBoard title={t('accounting.lifetimeCost')} titleWeight={titleWeight}>
              <AppText dir="ltr">
                {t('accounting.originalProduction')}: {money(query.data.lifetime.originalProductionCost)}
              </AppText>
              <AppText dir="ltr">
                {t('accounting.afterSaleReturn')}: {money(query.data.lifetime.afterSaleReturnCost)}
              </AppText>
              <AppText dir="ltr">
                {t('accounting.recoveredValue')}: {money(query.data.lifetime.recoveredValue)}
              </AppText>
              <AppText dir="ltr">
                {t('accounting.disposedValue')}: {money(query.data.lifetime.disposedValue)}
              </AppText>
            </DealerBoard>
          </ListItemEnter>
        </ScrollView>
      ) : null}
    </AppScreen>
  );
}
