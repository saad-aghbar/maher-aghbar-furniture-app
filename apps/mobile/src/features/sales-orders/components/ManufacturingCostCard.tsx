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

/** Piece 5 — estimated / actual / variance board (usage-based, not catalog BOM). */
export function ManufacturingCostCard({
  summary,
  formatCurrency,
  onViewBreakdown,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  if (!summary) return null;

  const est = summary.estimatedTotal;
  const act = summary.actualTotal;
  const variance = summary.varianceCost;
  const incomplete = summary.incomplete || summary.status === 'INCOMPLETE';
  const accent = incomplete ? colors.warning : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <OrderBoardCard
      accent={accent}
      header={
        <OrderSectionHeader
          icon="calculator-outline"
          label={t('mobile.orderDetail.mfgCostTitle')}
          accent={accent}
        />
      }
    >
      <AppText
        variant="caption"
        color="secondary"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {statusLabel(t, summary.status)}
        {incomplete ? ` · ${t('mobile.orderDetail.mfgCostIncompleteHint')}` : ''}
      </AppText>

      <View
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
        }}
      >
        <MoneyRow
          label={t('mobile.orderDetail.mfgCostEstimated')}
          value={est != null ? formatCurrency(est) : t('mobile.orderDetail.mfgCostUnavailable')}
          last={false}
          titleWeight={titleWeight}
        />
        <MoneyRow
          label={
            String(summary.status ?? '').toUpperCase() === 'IN_PROGRESS'
              ? t('mobile.orderDetail.mfgCostStatusInProgress')
              : t('mobile.orderDetail.mfgCostActual')
          }
          value={act != null ? formatCurrency(act) : t('mobile.orderDetail.mfgCostUnavailable')}
          last={false}
          titleWeight={titleWeight}
        />
        <MoneyRow
          label={t('mobile.orderDetail.mfgCostVariance')}
          value={
            variance != null
              ? `${variance >= 0 ? '+' : ''}${formatCurrency(variance)}`
              : t('mobile.orderDetail.mfgCostUnavailable')
          }
          last
          titleWeight={titleWeight}
          emphasize={variance != null && Math.abs(variance) > 0.009}
          warn={variance != null && variance > 0}
        />
      </View>

      <SecondaryButton
        label={t('mobile.orderDetail.mfgCostViewBreakdown')}
        onPress={onViewBreakdown}
        style={{ borderRadius: theme.radius.xl }}
      />
    </OrderBoardCard>
  );
}

function MoneyRow({
  label,
  value,
  last,
  titleWeight,
  emphasize,
  warn,
}: {
  label: string;
  value: string;
  last: boolean;
  titleWeight: 'medium' | 'semibold';
  emphasize?: boolean;
  warn?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        minHeight: theme.sizes.touch.min,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        borderBottomWidth: last ? 0 : 1,
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
