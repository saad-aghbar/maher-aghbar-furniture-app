import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AnimatedPressable } from '@/motion';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { PaymentMethod } from '@/api/modules/payments';
import { useUpdateAllocationMutation, useUpdatePaymentMutation } from '../query';

const METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'];

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  customerId?: string;
  payment: {
    id: string;
    allocationId?: string;
    kind?: 'payment' | 'credit';
    amount: number;
    method: string;
    reference?: string | null;
    paymentDate?: string | null;
  } | null;
  onSaved?: () => void;
};

export function EditPaymentSheet({ open, onClose, invoiceId, customerId, payment, onSaved }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const paymentMutation = useUpdatePaymentMutation(invoiceId, customerId);
  const allocationMutation = useUpdateAllocationMutation(invoiceId, customerId);
  const isCredit = payment?.kind === 'credit' && Boolean(payment.allocationId);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const seededId = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      seededId.current = null;
      return;
    }
    if (!payment) return;
    const seedKey = payment.allocationId ?? payment.id;
    if (seededId.current === seedKey) return;
    seededId.current = seedKey;
    setAmount(String(payment.amount));
    setMethod((METHODS.includes(payment.method as PaymentMethod)
      ? payment.method
      : 'BANK_TRANSFER') as PaymentMethod);
    setReference(payment.reference ?? '');
  }, [open, payment]);

  const save = () => {
    if (!payment) return;
    const next = Number(amount);
    if (!(next > 0)) return;
    const body = { amount: next, method, referenceNumber: reference.trim() || null };
    const onSuccess = () => {
      void haptics.confirmLight();
      onSaved?.();
      onClose();
    };
    if (isCredit && payment.allocationId) {
      allocationMutation.mutate({ id: payment.allocationId, body }, { onSuccess });
      return;
    }
    paymentMutation.mutate({ id: payment.id, body }, { onSuccess });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isCredit ? t('accounting.applyCredit') : t('mobile.invoices.editPayment')}
      sheetHeight={Math.min(Math.round(height * 0.62), 520)}
    >
      <View style={{ gap: theme.spacing.md }}>
        <QtyStepperField
          label={t('mobile.invoices.amount')}
          value={amount}
          onChangeText={setAmount}
          unit="₪"
          step={1}
          decimals={2}
          min={0.001}
        />
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
          {METHODS.map((row) => (
            <AnimatedPressable
              key={row}
              variant="button"
              onPress={() => setMethod(row)}
              style={{
                minHeight: 40,
                paddingHorizontal: 12,
                borderRadius: theme.radius.full,
                borderWidth: 1.5,
                borderColor: method === row ? colors.brand : colors.border,
                backgroundColor: method === row ? colors.brandSoft : colors.surface,
                justifyContent: 'center',
              }}
            >
              <AppText variant="caption" color={method === row ? 'brand' : 'secondary'}>
                {t(`accounting.method${row}`)}
              </AppText>
            </AnimatedPressable>
          ))}
        </View>
        <TextField
          value={reference}
          onChangeText={setReference}
          placeholder={t('mobile.invoices.reference')}
        />
        <PrimaryButton
          label={t('mobile.invoices.saveEdit')}
          loading={paymentMutation.isPending || allocationMutation.isPending}
          onPress={save}
          style={{ borderRadius: theme.radius.full, minHeight: 44 }}
        />
        <SecondaryButton
          label={t('common.cancel')}
          onPress={onClose}
          style={{ borderRadius: theme.radius.full, minHeight: 44 }}
        />
      </View>
    </BottomSheet>
  );
}
