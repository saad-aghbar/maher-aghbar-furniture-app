import { ScrollView, View, type ReactNode } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  getSalesOrderManufacturingCost,
  type ManufacturingCostingPayload,
} from '@/api/modules/sales-orders';
import { queryKeys } from '@/api/queryKeys';

type Props = {
  open: boolean;
  onClose: () => void;
  salesOrderId: string;
  formatCurrency: (n: number) => string;
};

export function ManufacturingCostBreakdownSheet({
  open,
  onClose,
  salesOrderId,
  formatCurrency,
}: Props) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const q = useQuery({
    queryKey: queryKeys.salesOrders.manufacturingCost(salesOrderId),
    queryFn: () => getSalesOrderManufacturingCost(salesOrderId),
    enabled: open && Boolean(salesOrderId),
  });

  const data = q.data;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.orderDetail.mfgCostBreakdownTitle')}
      sheetHeight={720}
    >
      {q.isError ? (
        <ErrorState message={t('mobile.orderDetail.mfgCostLoadError')} onRetry={() => q.refetch()} />
      ) : !data ? (
        <AppText variant="caption" color="muted">
          …
        </AppText>
      ) : (
        <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: 40 }}>
          <Hero data={data} formatCurrency={formatCurrency} />
          {(data.incompleteSkus?.length ?? 0) > 0 ? (
            <Section title={t('mobile.orderDetail.mfgCostIncompleteHint')}>
              {data.incompleteSkus!.map((row) => (
                <Row
                  key={row.sku}
                  label={row.displayName ?? row.sku}
                  value={`${row.costedQty} · ${t('mobile.orderDetail.mfgCostUnavailable')}`}
                />
              ))}
            </Section>
          ) : null}
          <Section title={t('mobile.orderDetail.mfgCostByCategory')}>
            {Object.entries(data.actual.byCategory ?? {}).map(([cat, row]) =>
              row.qty > 0 || row.cost > 0 ? (
                <Row
                  key={cat}
                  label={categoryLabel(t, cat)}
                  value={`${formatCurrency(row.cost)} · ${row.qty}`}
                />
              ) : null,
            )}
          </Section>
          {(data.lines?.length ?? 0) > 0 ? (
            <Section title={t('mobile.orderDetail.mfgCostByLine')}>
              {data.lines!.map((line) => (
                <View key={line.salesOrderLineId} style={{ gap: 4, marginBottom: theme.spacing.sm }}>
                  <AppText variant="body">{line.manufacturingName ?? line.salesOrderLineId}</AppText>
                  <Row
                    label={t('mobile.orderDetail.mfgCostEstimated')}
                    value={
                      line.estimatedTotal != null
                        ? formatCurrency(line.estimatedTotal)
                        : '—'
                    }
                  />
                  <Row
                    label={t('mobile.orderDetail.mfgCostActual')}
                    value={
                      line.actualTotal != null ? formatCurrency(line.actualTotal) : '—'
                    }
                  />
                </View>
              ))}
            </Section>
          ) : null}
          <Section title={t('mobile.orderDetail.mfgCostMaterials')}>
            {data.bySku.map((sku) => (
              <View
                key={sku.sku}
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  paddingVertical: theme.spacing.sm,
                  gap: 2,
                }}
              >
                <AppText variant="body">{sku.displayName ?? sku.sku}</AppText>
                <AppText variant="caption" color="muted">
                  {sku.sku}
                  {sku.origin === 'REWORK' || sku.origin === 'MIXED'
                    ? ` · ${t('mobile.orderDetail.mfgCostReworkTag')}`
                    : ''}
                </AppText>
                <Row
                  label={t('mobile.orderDetail.mfgCostPlannedIssued')}
                  value={`${sku.plannedQty} → ${sku.costedQty}`}
                />
                <Row
                  label={t('mobile.orderDetail.mfgCostUnit')}
                  value={
                    sku.unitCost != null
                      ? formatCurrency(sku.unitCost)
                      : t('mobile.orderDetail.mfgCostUnavailable')
                  }
                />
                <Row
                  label={t('mobile.orderDetail.mfgCostVariance')}
                  value={
                    sku.varianceCost != null
                      ? formatCurrency(sku.varianceCost)
                      : '—'
                  }
                />
              </View>
            ))}
          </Section>
          {(data.taskTrace?.length ?? 0) > 0 ? (
            <Section title={t('mobile.orderDetail.mfgCostTaskTrace')}>
              {data.taskTrace!.map((tr, idx) => (
                <View key={`${tr.taskId}-${tr.sku}-${idx}`} style={{ marginBottom: 8 }}>
                  <AppText variant="caption" color="muted">
                    {[tr.stageCode, tr.workerName].filter(Boolean).join(' · ') || tr.taskId}
                    {tr.isRework ? ` · ${t('mobile.orderDetail.mfgCostReworkTag')}` : ''}
                  </AppText>
                  <Row
                    label={tr.sku}
                    value={
                      tr.actualCost != null
                        ? `${tr.costedQty} · ${formatCurrency(tr.actualCost)}`
                        : String(tr.costedQty)
                    }
                  />
                </View>
              ))}
            </Section>
          ) : null}
        </ScrollView>
      )}
    </BottomSheet>
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

function Hero({
  data,
  formatCurrency,
}: {
  data: ManufacturingCostingPayload;
  formatCurrency: (n: number) => string;
}) {
  const { t } = useLocale();
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="caption" color="secondary">
        {statusLabel(t, data.status)}
        {data.incomplete ? ` · ${t('mobile.orderDetail.mfgCostIncompleteHint')}` : ''}
      </AppText>
      <Row
        label={t('mobile.orderDetail.mfgCostEstimated')}
        value={
          data.estimated.total != null
            ? formatCurrency(data.estimated.total)
            : t('mobile.orderDetail.mfgCostUnavailable')
        }
      />
      <Row
        label={t('mobile.orderDetail.mfgCostActual')}
        value={
          data.actual.total != null
            ? formatCurrency(data.actual.total)
            : t('mobile.orderDetail.mfgCostUnavailable')
        }
      />
      <Row
        label={t('mobile.orderDetail.mfgCostVariance')}
        value={
          data.variance.cost != null ? formatCurrency(data.variance.cost) : '—'
        }
      />
      {data.actual.scrapCost > 0 ? (
        <Row
          label={t('mobile.orderDetail.mfgCostScrap')}
          value={formatCurrency(data.actual.scrapCost)}
        />
      ) : null}
      {data.actual.reworkCost > 0 ? (
        <Row
          label={t('mobile.orderDetail.mfgCostRework')}
          value={formatCurrency(data.actual.reworkCost)}
        />
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="label">{title}</AppText>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
      }}
    >
      <AppText variant="caption" color="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </View>
  );
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
      return t('mobile.orderDetail.accessoriesCost');
    default:
      return cat;
  }
}
