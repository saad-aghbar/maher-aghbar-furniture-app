import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { OrderBoardCard, OrderSectionHeader } from './OrderBoardCard';

export type ManufacturingCostingSummary = {
  status?: string | null;
  incomplete?: boolean;
  estimatedTotal?: number | null;
  actualTotal?: number | null;
  varianceCost?: number | null;
  variancePct?: number | null;
  scrapCost?: number | null;
  finalizedAt?: string | null;
};

type Props = {
  summary: ManufacturingCostingSummary | null | undefined;
  formatCurrency: (n: number) => string;
  onViewBreakdown: () => void;
};

function statusLabel(
  t: (k: string) => string,
  status: string | null | undefined,
): string {
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

/** Piece 5 — compact actual manufacturing cost card (usage-based, not catalog BOM). */
export function ManufacturingCostCard({
  summary,
  formatCurrency,
  onViewBreakdown,
}: Props) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  if (!summary) return null;

  const est = summary.estimatedTotal;
  const act = summary.actualTotal;
  const variance = summary.varianceCost;
  const incomplete = summary.incomplete || summary.status === 'INCOMPLETE';

  return (
    <OrderBoardCard accent={incomplete ? colors.warning : colors.brand}>
      <OrderSectionHeader
        icon="calculator-outline"
        label={t('mobile.orderDetail.mfgCostTitle')}
        accent={incomplete ? colors.warning : colors.brand}
      />
      <AppText variant="caption" color="secondary">
        {statusLabel(t, summary.status)}
        {incomplete ? ` · ${t('mobile.orderDetail.mfgCostIncompleteHint')}` : ''}
      </AppText>
      <View
        style={{
          marginTop: theme.spacing.sm,
          gap: theme.spacing.xs,
        }}
      >
        <Row
          label={t('mobile.orderDetail.mfgCostEstimated')}
          value={est != null ? formatCurrency(est) : t('mobile.orderDetail.mfgCostUnavailable')}
        />
        <Row
          label={t('mobile.orderDetail.mfgCostActual')}
          value={act != null ? formatCurrency(act) : t('mobile.orderDetail.mfgCostUnavailable')}
        />
        <Row
          label={t('mobile.orderDetail.mfgCostVariance')}
          value={
            variance != null
              ? `${variance >= 0 ? '+' : ''}${formatCurrency(variance)}`
              : t('mobile.orderDetail.mfgCostUnavailable')
          }
          emphasize={variance != null && Math.abs(variance) > 0.009}
          warn={variance != null && variance > 0}
        />
      </View>
      <View style={{ marginTop: theme.spacing.md }}>
        <SecondaryButton
          label={t('mobile.orderDetail.mfgCostViewBreakdown')}
          onPress={onViewBreakdown}
        />
      </View>
    </OrderBoardCard>
  );
}

function Row({
  label,
  value,
  emphasize,
  warn,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  warn?: boolean;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText
        variant="body"
        style={{
          fontVariant: ['tabular-nums'],
          fontWeight: emphasize ? '600' : '400',
          color: warn ? colors.warning : colors.text,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
