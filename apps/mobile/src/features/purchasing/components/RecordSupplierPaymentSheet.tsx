import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { shouldSeedInvoiceSheet } from '@/features/invoices/invoiceSheetSeed';
import { useRecordSupplierPaymentMutation } from '../query';

const METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  supplierId: string;
  outstanding: number;
  onRecorded?: () => void;
};

export function RecordSupplierPaymentSheet({
  open,
  onClose,
  invoiceId,
  supplierId,
  outstanding,
  onRecorded,
}: Props) {
  const { t, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const mutation = useRecordSupplierPaymentMutation(invoiceId);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const wasOpen = useRef(false);
  const cap = Math.max(0, outstanding);

  useEffect(() => {
    if (shouldSeedInvoiceSheet(open, wasOpen.current)) {
      setAmount(cap > 0 ? String(Number(cap.toFixed(3))) : '');
      setMethod('BANK_TRANSFER');
      setReference('');
      setNotes('');
    }
    wasOpen.current = open;
  }, [cap, open]);

  const save = () => {
    const next = Number(amount);
    if (!(next > 0) || next - cap > 1e-6) return;
    mutation.mutate(
      {
        supplierId,
        supplierInvoiceId: invoiceId,
        amount: next,
        method,
        referenceNumber: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          void haptics.confirmLight();
          showToast({ variant: 'success', message: t('mobile.invoices.supplierPaymentSuccess') });
          onClose();
          onRecorded?.();
        },
        onError: () => {
          void haptics.error();
          showToast({ variant: 'error', message: t('mobile.invoices.paymentFailed') });
        },
      },
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.invoices.recordSupplierPayment')}
      sheetHeight={Math.min(Math.round(height * 0.68), 560)}
    >
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="caption" color="muted">
          {t('mobile.invoices.supplierOutstanding', { amount: formatCurrency(cap) })}
        </AppText>
        <QtyStepperField
          label={t('mobile.invoices.amount')}
          value={amount}
          onChangeText={setAmount}
          max={cap}
          min={0.001}
          unit="₪"
          step={1}
          decimals={2}
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
        <TextField value={reference} onChangeText={setReference} placeholder={t('mobile.invoices.reference')} />
        <TextField value={notes} onChangeText={setNotes} placeholder={t('mobile.invoices.notesPlaceholder')} />
        <PrimaryButton
          label={t('mobile.invoices.recordSupplierPayment')}
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
