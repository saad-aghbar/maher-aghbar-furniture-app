import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { Invoice } from '../api';
import { InvoiceFloorBoard } from './InvoiceFloorBoard';

type Props = {
  invoice: Invoice;
  onOpenReturn?: (returnId: string) => void;
  onOpenOrder?: (orderId: string) => void;
};

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function InvoiceReturnBoard({ invoice, onOpenReturn, onOpenOrder }: Props) {
  const ret = invoice.returnRequest;
  const { t, isRTL, formatCurrency, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  if (!ret) return null;

  const dealerShare = num(ret.chargeAmount);
  const factoryShare = num(ret.factoryShareAmount);
  const actual = num(invoice.reworkCost?.actualTotal);
  const estimated = num(invoice.reworkCost?.estimatedTotal);
  const cost = actual ?? estimated;
  const costLabel = actual != null
    ? t('mobile.invoices.returnActualCost')
    : estimated != null
      ? t('mobile.invoices.returnEstimatedCost')
      : t('mobile.invoices.returnCostUnknown');

  return (
    <InvoiceFloorBoard title={t('mobile.invoices.returnStory')}>
      <Row
        label={t('mobile.invoices.returnResponsibility')}
        value={t(`mobile.returns.responsibilityOption.${String(ret.responsibility ?? 'UNDETERMINED')}`)}
        isRTL={isRTL}
      />
      {dealerShare != null ? (
        <Row label={t('mobile.invoices.dealerShare')} value={formatCurrency(dealerShare)} isRTL={isRTL} />
      ) : null}
      {factoryShare != null ? (
        <Row label={t('mobile.invoices.factoryShare')} value={formatCurrency(factoryShare)} isRTL={isRTL} />
      ) : null}
      <Row
        label={costLabel}
        value={cost != null ? formatCurrency(cost) : '—'}
        isRTL={isRTL}
      />
      {ret.chargeSentAt ? (
        <Row label={t('mobile.invoices.chargeSent')} value={formatDate(ret.chargeSentAt)} isRTL={isRTL} />
      ) : null}
      {ret.chargeConfirmedAt ? (
        <Row label={t('mobile.invoices.chargeConfirmed')} value={formatDate(ret.chargeConfirmedAt)} isRTL={isRTL} />
      ) : null}
      {ret.chargeRejectedAt ? (
        <Row
          label={t('mobile.invoices.chargeRejected')}
          value={ret.chargeRejectionNote || formatDate(ret.chargeRejectedAt)}
          isRTL={isRTL}
        />
      ) : null}

      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        {onOpenReturn ? (
          <AnimatedPressable
            variant="button"
            onPress={() => {
              void haptics.selection();
              onOpenReturn(ret.id);
            }}
          >
            <AppText color="brand" weight="semibold">
              {ret.number}
            </AppText>
          </AnimatedPressable>
        ) : (
          <AppText dir="ltr">{ret.number}</AppText>
        )}
        {ret.salesOrder && onOpenOrder ? (
          <AnimatedPressable
            variant="button"
            onPress={() => {
              void haptics.selection();
              onOpenOrder(ret.salesOrder!.id);
            }}
          >
            <AppText color="brand" weight="semibold">
              {ret.salesOrder.number}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </View>

      {(ret.pieces ?? []).length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="muted">
            {t('mobile.invoices.returnPieces')}
          </AppText>
          {(ret.pieces ?? []).map((piece) => (
            <View
              key={piece.id}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.sm,
              }}
            >
              <AppText weight="semibold" dir="ltr">
                {piece.code}
              </AppText>
              <AppText variant="caption" color="secondary">
                {[piece.decision, piece.state].filter(Boolean).join(' · ')}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </InvoiceFloorBoard>
  );
}

function Row({
  label,
  value,
  isRTL,
}: {
  label: string;
  value: string;
  isRTL: boolean;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: 4,
      }}
    >
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir="ltr"
        style={{ flex: 1, textAlign: isRTL ? 'left' : 'right', color: colors.textPrimary }}
      >
        {value}
      </AppText>
    </View>
  );
}
