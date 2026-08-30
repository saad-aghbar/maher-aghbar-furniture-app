import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { recordPayment, type PaymentMethod } from '@/api/modules/payments';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

const METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'];

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  customerId: string;
  /** Invoice remaining (outstanding) — overpay above this becomes account credit. */
  defaultAmount: number;
};

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Record payment bottom sheet — allows overpay; shows allocation vs account credit.
 */
export function RecordPaymentSheet({
  open,
  onClose,
  invoiceId,
  customerId,
  defaultAmount,
}: Props) {
  const { t, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const qc = useQueryClient();

  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const remaining = Math.max(0, defaultAmount);
  const sheetHeight = Math.min(Math.round(height * 0.72), 620);

  useEffect(() => {
    if (!open) return;
    setMethod('BANK_TRANSFER');
    setAmount(remaining > 0 ? String(Number(remaining.toFixed(3))) : '');
    setReference('');
  }, [open, remaining]);

  const payN = Number(amount);
  const breakdown = useMemo(() => {
    if (!Number.isFinite(payN) || payN <= 0) {
      return { allocated: 0, credit: 0, overpay: false };
    }
    const allocated = round3(Math.min(payN, remaining));
    const credit = round3(Math.max(0, payN - remaining));
    return { allocated, credit, overpay: credit > 0.0005 };
  }, [payN, remaining]);

  const payMutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) });
      await qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      await qc.invalidateQueries({ queryKey: queryKeys.payments.lists() });
      await qc.invalidateQueries({ queryKey: queryKeys.payments.dealerSummary(customerId) });
      await qc.invalidateQueries({ queryKey: queryKeys.statements.detail(customerId) });
    },
  });

  const methodLabel = (m: PaymentMethod) => {
    const key = `accounting.method${m}`;
    const translated = t(key);
    return translated === key ? t(`mobile.account.method.${m}`) : translated;
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('accounting.recordPayment')}
      sheetHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText
            variant="caption"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('accounting.paymentMethod')}
          </AppText>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {METHODS.map((m) => {
              const selected = method === m;
              return (
                <SecondaryButton
                  key={m}
                  label={methodLabel(m)}
                  onPress={() => {
                    void haptics.selection();
                    setMethod(m);
                  }}
                  style={{
                    borderRadius: theme.radius.xl,
                    borderColor: selected ? colors.brand : colors.borderStrong,
                    backgroundColor: selected ? colors.brandSoft : colors.surface,
                  }}
                />
              );
            })}
          </View>
        </View>

        <TextField
          label={t('accounting.amountJod')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('accounting.referenceOptional')}
          value={reference}
          onChangeText={setReference}
        />

        {Number.isFinite(payN) && payN > 0 ? (
          <View
            style={{
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <BreakdownRow
              label={t('accounting.paymentAmount')}
              value={formatCurrency(payN)}
            />
            <BreakdownRow
              label={t('accounting.allocatedToInvoices')}
              value={formatCurrency(breakdown.allocated)}
            />
            <BreakdownRow
              label={t('accounting.addedToAccountCredit')}
              value={formatCurrency(breakdown.credit)}
              emphasize={breakdown.overpay}
            />
            {breakdown.overpay ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('accounting.overpayCreditHint')}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <PrimaryButton
          label={t('accounting.recordPayment')}
          loading={payMutation.isPending}
          style={{ borderRadius: theme.radius.xl }}
          onPress={() => {
            if (!Number.isFinite(payN) || payN <= 0) {
              void haptics.error();
              showToast({
                variant: 'error',
                message: t('mobile.invoices.paymentFailed'),
              });
              return;
            }
            const allocated = breakdown.allocated;
            payMutation.mutate(
              {
                customerId,
                invoiceId,
                amount: payN,
                method,
                referenceNumber: reference.trim() || undefined,
                idempotencyKey: `pay-${invoiceId}-${Date.now()}`,
                allocations:
                  allocated > 0
                    ? [{ invoiceId, amount: allocated }]
                    : [],
              },
              {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  onClose();
                  showToast({
                    variant: 'success',
                    message: t('accounting.paymentRecorded'),
                  });
                },
                onError: () => {
                  void haptics.error();
                  showToast({
                    variant: 'error',
                    message: t('mobile.invoices.paymentFailed'),
                  });
                },
              },
            );
          }}
        />
        <SecondaryButton
          label={t('common.cancel')}
          onPress={onClose}
          style={{ borderRadius: theme.radius.xl }}
        />
      </View>
    </BottomSheet>
  );
}

function BreakdownRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <AppText
        variant="caption"
        color={emphasize ? 'brand' : 'secondary'}
        style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir="ltr"
        style={{
          color: emphasize ? colors.brand : colors.textPrimary,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
