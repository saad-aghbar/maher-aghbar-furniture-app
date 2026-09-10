import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useUpdateSupplierPaymentMutation } from '../query';

const METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  payment: {
    id: string;
    amount: number | string;
    method?: string | null;
    referenceNumber?: string | null;
  } | null;
  onSaved?: () => void;
};

export function EditSupplierPaymentSheet({ open, onClose, invoiceId, payment, onSaved }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const mutation = useUpdateSupplierPaymentMutation(invoiceId);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const seededId = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      seededId.current = null;
      return;
    }
    if (!payment || seededId.current === payment.id) return;
    seededId.current = payment.id;
    setAmount(String(payment.amount));
    setMethod(
      METHODS.includes(payment.method as (typeof METHODS)[number])
        ? (payment.method as (typeof METHODS)[number])
        : 'BANK_TRANSFER',
    );
    setReference(payment.referenceNumber ?? '');
  }, [open, payment]);

  const save = () => {
    if (!payment) return;
    const next = Number(amount);
    if (!(next > 0)) return;
    mutation.mutate(
      {
        id: payment.id,
        body: { amount: next, method, referenceNumber: reference.trim() || null },
      },
      {
        onSuccess: () => {
          void haptics.confirmLight();
          onSaved?.();
          onClose();
        },
      },
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.invoices.editPayment')}
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
          loading={mutation.isPending}
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
