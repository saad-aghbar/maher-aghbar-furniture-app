import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { InvoiceFloorBoard } from '@/features/invoices/components/InvoiceFloorBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { SupplierInvoice } from '../api';
import { useUpdateSupplierInvoiceMutation } from '../query';

type LineDraft = {
  key: string;
  id?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  invoice: SupplierInvoice;
  onSaved?: () => void;
};

function toYmd(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Edit purchasing invoice — notes, due date, and line amounts. */
export function EditSupplierInvoiceSheet({ open, onClose, invoice, onSaved }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mutation = useUpdateSupplierInvoiceMutation(invoice.id);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotes(invoice.notes ?? '');
    setDueDate(toYmd(invoice.dueDate));
    setLines(
      (invoice.lines ?? []).map((l, i) => ({
        key: l.id || `new-${i}`,
        id: l.id,
        description: l.description ?? '',
        quantity: String(Number(l.quantity) || 0),
        unitPrice: String(Number(l.unitPrice) || 0),
        taxRate: String(Number(l.taxRate ?? 0) || 0),
      })),
    );
    setError(null);
  }, [open, invoice]);

  const save = () => {
    if (lines.length === 0) {
      setError(t('mobile.invoices.editNeedLines'));
      return;
    }
    const payloadLines = lines.map((l) => ({
      id: l.id,
      description: l.description.trim() || 'Line',
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice) || 0,
      taxRate: Number(l.taxRate) || 0,
    }));
    mutation.mutate(
      {
        notes: notes.trim() || null,
        dueDate: dueDate.trim() || null,
        lines: payloadLines,
      },
      {
        onSuccess: () => {
          void haptics.confirmMedium();
          onSaved?.();
          onClose();
        },
        onError: () => {
          void haptics.error();
          setError(t('mobile.invoices.editFailed'));
        },
      },
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.invoices.editTitle')}
      fitContent
      maxHeight={680}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
      >
        <InvoiceFloorBoard title={t('mobile.invoices.dueDate')}>
          <TextField
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            autoCorrect={false}
          />
          <AppText variant="caption" color="muted">
            {t('mobile.invoices.notes')}
          </AppText>
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder={t('mobile.invoices.notesPlaceholder')}
            multiline
            numberOfLines={3}
            style={{ minHeight: 88, textAlignVertical: 'top' }}
          />
        </InvoiceFloorBoard>

        <InvoiceFloorBoard
          title={t('mobile.invoices.items')}
          trailing={
            <AnimatedPressable
              variant="button"
              onPress={() => {
                void haptics.selection();
                setLines((prev) => [
                  ...prev,
                  {
                    key: `new-${Date.now()}`,
                    description: '',
                    quantity: '1',
                    unitPrice: '0',
                    taxRate: '0',
                  },
                ]);
              }}
              style={{
                minHeight: 36,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.brand,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="add" size={16} color={colors.brand} />
              <AppText variant="caption" weight={titleWeight} color="brand">
                {t('mobile.invoices.addLine')}
              </AppText>
            </AnimatedPressable>
          }
        >
          <View style={{ gap: theme.spacing.sm }}>
            {lines.map((line) => (
              <View
                key={line.key}
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  padding: theme.spacing.sm,
                  gap: theme.spacing.xs,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppTextInput
                    value={line.description}
                    onChangeText={(v) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key ? { ...row, description: v } : row,
                        ),
                      )
                    }
                    placeholder={t('mobile.invoices.lineDescription')}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.spacing.sm,
                      color: colors.textPrimary,
                      backgroundColor: colors.surface,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  />
                  {lines.length > 1 ? (
                    <AnimatedPressable
                      variant="button"
                      onPress={() => {
                        void haptics.selection();
                        setLines((prev) => prev.filter((row) => row.key !== line.key));
                      }}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </AnimatedPressable>
                  ) : null}
                </View>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: theme.spacing.sm,
                  }}
                >
                  <Field
                    label={t('mobile.invoices.qty')}
                    value={line.quantity}
                    onChange={(v) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key ? { ...row, quantity: v } : row,
                        ),
                      )
                    }
                  />
                  <Field
                    label={t('mobile.invoices.unitPrice')}
                    value={line.unitPrice}
                    onChange={(v) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key ? { ...row, unitPrice: v } : row,
                        ),
                      )
                    }
                  />
                </View>
              </View>
            ))}
          </View>
        </InvoiceFloorBoard>

        {error ? (
          <AppText variant="caption" color="error" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {error}
          </AppText>
        ) : null}

        <PrimaryButton
          label={t('mobile.invoices.saveEdit')}
          loading={mutation.isPending}
          onPress={save}
          style={{ borderRadius: theme.radius.xl }}
        />
      </ScrollView>
    </BottomSheet>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppTextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        style={{
          minHeight: 40,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.sm,
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          textAlign: isRTL ? 'right' : 'left',
        }}
      />
    </View>
  );
}
