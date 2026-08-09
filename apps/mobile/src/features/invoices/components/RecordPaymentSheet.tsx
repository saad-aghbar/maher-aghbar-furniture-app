import { useEffect, useState } from 'react';
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
  defaultAmount: number;
};

/**
 * Record payment bottom sheet — safe bottom inset, localized methods.
 */
export function RecordPaymentSheet({
  open,
  onClose,
  invoiceId,
  customerId,
  defaultAmount,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const qc = useQueryClient();

  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const sheetHeight = Math.min(Math.round(height * 0.62), 520);

  useEffect(() => {
    if (!open) return;
    setMethod('BANK_TRANSFER');
    setAmount(
      defaultAmount > 0 ? String(Number(defaultAmount.toFixed(3))) : '',
    );
    setReference('');
  }, [open, defaultAmount]);

  const payMutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) });
      await qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      await qc.invalidateQueries({ queryKey: queryKeys.payments.lists() });
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

        <PrimaryButton
          label={t('accounting.recordPayment')}
          loading={payMutation.isPending}
          style={{ borderRadius: theme.radius.xl }}
          onPress={() => {
            const n = Number(amount);
            if (!Number.isFinite(n) || n <= 0) {
              void haptics.error();
              showToast({
                variant: 'error',
                message: t('mobile.invoices.paymentFailed'),
              });
              return;
            }
            payMutation.mutate(
              {
                customerId,
                invoiceId,
                amount: n,
                method,
                referenceNumber: reference.trim() || undefined,
                idempotencyKey: `pay-${invoiceId}-${Date.now()}`,
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
