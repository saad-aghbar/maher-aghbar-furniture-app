import { type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  getSalesOrderManufacturingCost,
  type ManufacturingCostingPayload,
} from '@/api/modules/sales-orders';
import { queryKeys } from '@/api/queryKeys';
import { OrderBoardCard, OrderSectionHeader } from './OrderBoardCard';

type Props = {
  open: boolean;
  onClose: () => void;
  salesOrderId: string;
  formatCurrency: (n: number) => string;
};

/**
 * Floor sheet — estimated / actual / variance boards + category & SKU ledgers.
 */
export function ManufacturingCostBreakdownSheet({
  open,
  onClose,
  salesOrderId,
  formatCurrency,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const q = useQuery({
    queryKey: queryKeys.salesOrders.manufacturingCost(salesOrderId),
    queryFn: () => getSalesOrderManufacturingCost(salesOrderId),
    enabled: open && Boolean(salesOrderId),
    staleTime: 8_000,
    refetchOnWindowFocus: true,
  });

  const data = q.data;
  const incomplete = Boolean(data?.incomplete || data?.status === 'INCOMPLETE');
  const accent = incomplete ? colors.warning : colors.brand;

  const categoryRows = Object.entries(data?.actual.byCategory ?? {}).filter(
    ([, row]) => row.qty > 0 || row.cost > 0,
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.orderDetail.mfgCostBreakdownTitle')}
      sheetHeight={720}
    >
      <View style={{ flex: 1, gap: theme.spacing.md }}>
        {q.isError ? (
          <ErrorState
            title={t('mobile.orderDetail.mfgCostLoadError')}
            onRetry={() => {
              void q.refetch();
            }}
          />
        ) : !data ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.xl,
            }}
          >
            <ActivityIndicator color={colors.brand} />
            <AppText variant="caption" color="muted">
              …
            </AppText>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              gap: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
            }}
            showsVerticalScrollIndicator={false}
          >
            <OrderBoardCard
              accent={accent}
              header={
                <OrderSectionHeader
                  icon="calculator-outline"
                  label={t('mobile.orderDetail.mfgCostTitle')}
                  accent={accent}
                  trailing={
                    <StatusBadge
                      status={data.status}
                      label={statusLabel(t, data.status)}
                      dot
                      branded
                    />
                  }
                />
              }
            >
              {incomplete ? (
                <AppText
                  variant="caption"
                  style={{
                    color: colors.warning,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {t('mobile.orderDetail.mfgCostIncompleteHint')}
                </AppText>
              ) : null}

              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.orderDetail.mfgCostActual')}
              </AppText>
              <AppText
                variant="heading"
                weight={titleWeight}
                color={incomplete ? undefined : 'brand'}
                dir="ltr"
                style={incomplete ? { color: colors.warning } : undefined}
              >
                {data.actual.total != null
                  ? formatCurrency(data.actual.total)
                  : t('mobile.orderDetail.mfgCostUnavailable')}
              </AppText>

              <InsetLedger>
                <MoneyRow
                  label={t('mobile.orderDetail.mfgCostEstimated')}
                  value={
                    data.estimated.total != null
                      ? formatCurrency(data.estimated.total)
                      : t('mobile.orderDetail.mfgCostUnavailable')
                  }
                  titleWeight={titleWeight}
                />
                <MoneyRow
                  label={t('mobile.orderDetail.mfgCostActual')}
                  value={
                    data.actual.total != null
                      ? formatCurrency(data.actual.total)
                      : t('mobile.orderDetail.mfgCostUnavailable')
                  }
                  titleWeight={titleWeight}
                />
                <MoneyRow
                  label={t('mobile.orderDetail.mfgCostVariance')}
                  value={
                    data.variance.cost != null
                      ? `${data.variance.cost >= 0 ? '+' : ''}${formatCurrency(data.variance.cost)}`
                      : '—'
                  }
                  titleWeight={titleWeight}
                  emphasize={
                    data.variance.cost != null && Math.abs(data.variance.cost) > 0.009
                  }
                  warn={data.variance.cost != null && data.variance.cost > 0}
                  last={
                    !(data.actual.scrapCost > 0) && !(data.actual.reworkCost > 0)
                  }
                />
                {data.actual.scrapCost > 0 ? (
                  <MoneyRow
                    label={t('mobile.orderDetail.mfgCostScrap')}
                    value={formatCurrency(data.actual.scrapCost)}
                    titleWeight={titleWeight}
                    warn
                    last={!(data.actual.reworkCost > 0)}
                  />
                ) : null}
                {data.actual.reworkCost > 0 ? (
                  <MoneyRow
                    label={t('mobile.orderDetail.mfgCostRework')}
                    value={formatCurrency(data.actual.reworkCost)}
                    titleWeight={titleWeight}
                    warn
                    last
                  />
                ) : null}
              </InsetLedger>
            </OrderBoardCard>

            {(data.incompleteSkus?.length ?? 0) > 0 ? (
              <OrderBoardCard
                accent={colors.warning}
                header={
                  <OrderSectionHeader
                    icon="alert-circle-outline"
                    label={t('mobile.orderDetail.mfgCostIncompleteHint')}
                    accent={colors.warning}
                  />
                }
              >
                <InsetLedger>
                  {data.incompleteSkus!.map((row, index) => (
                    <MoneyRow
                      key={row.sku}
                      label={row.displayName ?? row.sku}
                      value={`${row.costedQty} · ${t('mobile.orderDetail.mfgCostUnavailable')}`}
                      titleWeight={titleWeight}
                      last={index === data.incompleteSkus!.length - 1}
                      warn
                    />
                  ))}
                </InsetLedger>
              </OrderBoardCard>
            ) : null}

            <OrderBoardCard
              header={
                <OrderSectionHeader
                  icon="layers-outline"
                  label={t('mobile.orderDetail.mfgCostByCategory')}
                />
              }
            >
              {categoryRows.length === 0 ? (
                <DealerEmptyPanel
                  text={t('mobile.orderDetail.mfgCostUnavailable')}
                  icon="layers-outline"
                  nested
                  compact
                />
              ) : (
                <InsetLedger>
                  {categoryRows.map(([cat, row], index) => (
                    <MoneyRow
                      key={cat}
                      label={categoryLabel(t, cat)}
                      value={`${formatCurrency(row.cost)} · ${t('mobile.orderDetail.qty')} ${row.qty}`}
                      titleWeight={titleWeight}
                      last={index === categoryRows.length - 1}
                    />
                  ))}
                </InsetLedger>
              )}
            </OrderBoardCard>

            {(data.lines?.length ?? 0) > 0 ? (
              <OrderBoardCard
                header={
                  <OrderSectionHeader
                    icon="list-outline"
                    label={t('mobile.orderDetail.mfgCostByLine')}
                  />
                }
              >
                <View style={{ gap: theme.spacing.sm }}>
                  {data.lines!.map((line) => (
                    <View
                      key={line.salesOrderLineId}
                      style={{
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSecondary,
                        padding: theme.spacing.md,
                        gap: theme.spacing.xs,
                      }}
                    >
                      <AppText
                        variant="label"
                        weight={titleWeight}
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        numberOfLines={2}
                      >
                        {line.manufacturingName ?? line.salesOrderLineId}
                      </AppText>
                      <MoneyRow
                        label={t('mobile.orderDetail.mfgCostEstimated')}
                        value={
                          line.estimatedTotal != null
                            ? formatCurrency(line.estimatedTotal)
                            : '—'
                        }
                        titleWeight={titleWeight}
                        bare
                      />
                      <MoneyRow
                        label={t('mobile.orderDetail.mfgCostActual')}
                        value={
                          line.actualTotal != null
                            ? formatCurrency(line.actualTotal)
                            : '—'
                        }
                        titleWeight={titleWeight}
                        bare
                      />
                    </View>
                  ))}
                </View>
              </OrderBoardCard>
            ) : null}

            <OrderBoardCard
              header={
                <OrderSectionHeader
                  icon="cube-outline"
                  label={t('mobile.orderDetail.mfgCostMaterials')}
                  trailing={
                    data.bySku.length > 0 ? (
                      <AppText variant="caption" color="muted" dir="ltr">
                        {String(data.bySku.length)}
                      </AppText>
                    ) : null
                  }
                />
              }
            >
              {data.bySku.length === 0 ? (
                <DealerEmptyPanel
                  text={t('mobile.orderDetail.noMaterialsYet')}
                  icon="cube-outline"
                  nested
                  compact
                />
              ) : (
                <View style={{ gap: theme.spacing.sm }}>
                  {data.bySku.map((sku) => (
                    <SkuBoard
                      key={sku.sku}
                      sku={sku}
                      formatCurrency={formatCurrency}
                      titleWeight={titleWeight}
                    />
                  ))}
                </View>
              )}
            </OrderBoardCard>

            {(data.taskTrace?.length ?? 0) > 0 ? (
              <OrderBoardCard
                header={
                  <OrderSectionHeader
                    icon="git-commit-outline"
                    label={t('mobile.orderDetail.mfgCostTaskTrace')}
                  />
                }
              >
                <InsetLedger>
                  {data.taskTrace!.map((tr, idx) => (
                    <View
                      key={`${tr.taskId}-${tr.sku}-${idx}`}
                      style={{
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm + 2,
                        borderBottomWidth:
                          idx === data.taskTrace!.length - 1 ? 0 : 1,
                        borderBottomColor: colors.border,
                        gap: 4,
                      }}
                    >
                      <AppText
                        variant="caption"
                        color="muted"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {[tr.stageCode, tr.workerName].filter(Boolean).join(' · ') ||
                          tr.taskId}
                        {tr.isRework
                          ? ` · ${t('mobile.orderDetail.mfgCostReworkTag')}`
                          : ''}
                      </AppText>
                      <MoneyRow
                        label={tr.sku}
                        value={
                          tr.actualCost != null
                            ? `${tr.costedQty} · ${formatCurrency(tr.actualCost)}`
                            : String(tr.costedQty)
                        }
                        titleWeight={titleWeight}
                        bare
                      />
                    </View>
                  ))}
                </InsetLedger>
              </OrderBoardCard>
            ) : null}
          </ScrollView>
        )}

        <View
          style={{
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <SecondaryButton
            label={t('mobile.orderDetail.categoryDone')}
            onPress={onClose}
            style={{ borderRadius: theme.radius.xl }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function SkuBoard({
  sku,
  formatCurrency,
  titleWeight,
}: {
  sku: ManufacturingCostingPayload['bySku'][number];
  formatCurrency: (n: number) => string;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const rework = sku.origin === 'REWORK' || sku.origin === 'MIXED';
  const varianceWarn = sku.varianceCost != null && sku.varianceCost > 0;

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: varianceWarn ? colors.warning : colors.border,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 2,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
            numberOfLines={2}
          >
            {sku.displayName ?? sku.sku}
          </AppText>
          {rework ? (
            <StatusBadge
              status="REWORK"
              label={t('mobile.orderDetail.mfgCostReworkTag')}
              branded
            />
          ) : null}
        </View>
        <AppText variant="caption" color="muted" dir="ltr">
          {sku.sku}
        </AppText>
      </View>
      <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, gap: 4 }}>
        <MoneyRow
          label={t('mobile.orderDetail.mfgCostPlannedIssued')}
          value={`${sku.plannedQty} → ${sku.costedQty}`}
          titleWeight={titleWeight}
          bare
        />
        <MoneyRow
          label={t('mobile.orderDetail.mfgCostUnit')}
          value={
            sku.unitCost != null
              ? formatCurrency(sku.unitCost)
              : t('mobile.orderDetail.mfgCostUnavailable')
          }
          titleWeight={titleWeight}
          bare
          warn={!sku.costAvailable}
        />
        <MoneyRow
          label={t('mobile.orderDetail.mfgCostVariance')}
          value={sku.varianceCost != null ? formatCurrency(sku.varianceCost) : '—'}
          titleWeight={titleWeight}
          bare
          emphasize={sku.varianceCost != null && Math.abs(sku.varianceCost) > 0.009}
          warn={varianceWarn}
        />
      </View>
    </View>
  );
}

function InsetLedger({ children }: { children: ReactNode }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function MoneyRow({
  label,
  value,
  titleWeight,
  last,
  bare,
  emphasize,
  warn,
}: {
  label: string;
  value: string;
  titleWeight: 'medium' | 'semibold';
  last?: boolean;
  /** No hairline / inset padding — for nested panels. */
  bare?: boolean;
  emphasize?: boolean;
  warn?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        minHeight: bare ? undefined : theme.sizes.touch.min,
        paddingHorizontal: bare ? 0 : theme.spacing.md,
        paddingVertical: bare ? 2 : theme.spacing.sm + 2,
        borderBottomWidth: bare || last ? 0 : 1,
        borderBottomColor: colors.border,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
        numberOfLines={2}
      >
        {label}
      </AppText>
      <AppText
        variant="label"
        weight={emphasize ? titleWeight : 'regular'}
        dir="ltr"
        style={{
          fontVariant: ['tabular-nums'],
          color: warn ? colors.warning : colors.textPrimary,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}

function statusLabel(t: (k: string) => string, status: string | null | undefined): string {
  switch (String(status ?? '').toUpperCase()) {
    case 'FINAL':
      return t('mobile.orderDetail.mfgCostStatusFinal');
    case 'IN_PROGRESS':
      return t('mobile.orderDetail.mfgCostStatusInProgress');
    case 'INCOMPLETE':
      return t('mobile.orderDetail.mfgCostStatusIncomplete');
    case 'ESTIMATED_ONLY':
      return t('mobile.orderDetail.mfgCostStatusEstimatedOnly');
    default:
      return t('mobile.orderDetail.mfgCostStatusEstimatedOnly');
  }
}

function categoryLabel(t: (k: string) => string, cat: string): string {
  switch (cat) {
    case 'fabric':
      return t('mobile.orderDetail.fabricCost');
    case 'wood':
      return t('mobile.orderDetail.woodCost');
    case 'foam':
      return t('mobile.orderDetail.foamCost');
    case 'hardware':
    case 'accessories':
      return t('mobile.orderDetail.accessoriesCost');
    default:
      return cat;
  }
}
