import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { DatePickerField } from '@/components/calendar/DatePickerField';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { InvoiceFloorBoard } from '@/features/invoices/components/InvoiceFloorBoard';
import { InvoiceItemPickerSheet } from '@/features/invoices/components/InvoiceItemPickerSheet';
import { InvoiceRowActionChip } from '@/features/invoices/components/InvoiceRowActionChip';
import {
  applyInvoiceLinePick,
  invoiceEditErrorMessage,
  type InvoiceLineDraft,
} from '@/features/invoices/invoiceLineDraft';
import { percentToStoredTaxRate, storedTaxRateToPercent } from '@/features/invoices/invoiceTaxRate';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { SupplierInvoice } from '../api';
import { useUpdateSupplierInvoiceMutation } from '../query';

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

export function EditSupplierInvoiceSheet({ open, onClose, invoice, onSaved }: Props) {
  const { t, isRTL, locale, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mutation = useUpdateSupplierInvoiceMutation(invoice.id);
  const paid = Number(invoice.paidAmount) || 0;
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [total, setTotal] = useState('');
  const [deriveFromLines, setDeriveFromLines] = useState(true);
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<'list' | 'custom'>('list');
  const [pickerCustomName, setPickerCustomName] = useState('');
  const pendingPicker = useRef(false);
  const editingLineKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditVisible(false);
      setPickerOpen(false);
      pendingPicker.current = false;
      return;
    }
    setEditVisible(true);
    setNotes(invoice.notes ?? '');
    setDueDate(toYmd(invoice.dueDate));
    setInvoiceDate(toYmd(invoice.invoiceDate));
    setSubtotal(String(Number(invoice.subtotal) || 0));
    setTax(String(Number(invoice.taxTotal ?? invoice.taxAmount) || 0));
    setTotal(String(Number(invoice.total) || 0));
    setDeriveFromLines(true);
    setLines(
      (invoice.lines ?? []).map((l, i) => ({
        key: l.id || `new-${i}`,
        id: l.id,
        description: l.description ?? '',
        quantity: String(Number(l.quantity) || 0),
        unitPrice: String(Number(l.unitPrice) || 0),
        taxPercent: String(storedTaxRateToPercent(l.taxRate)),
      })),
    );
    setError(null);
    setPickerOpen(false);
  }, [open, invoice]);

  const derived = useMemo(() => {
    const sub = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);
    const taxAmt = lines.reduce((sum, line) => {
      const net = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
      return sum + net * ((Number(line.taxPercent) || 0) / 100);
    }, 0);
    return {
      subtotal: Math.round(sub * 1000) / 1000,
      tax: Math.round(taxAmt * 1000) / 1000,
      total: Math.round((sub + taxAmt) * 1000) / 1000,
    };
  }, [lines]);

  const nextTotal = deriveFromLines ? derived.total : Number(total) || 0;

  const openPicker = (line?: InvoiceLineDraft) => {
    void haptics.selection();
    const key = line?.key ?? null;
    editingLineKeyRef.current = key;
    setEditingLineKey(key);
    setPickerMode(line?.origin === 'custom' ? 'custom' : 'list');
    setPickerCustomName(line?.description ?? '');
    pendingPicker.current = true;
    setEditVisible(false);
  };

  const applyPick = (pick: Parameters<typeof applyInvoiceLinePick>[1]) => {
    setLines((prev) => applyInvoiceLinePick(prev, pick, editingLineKeyRef.current));
  };

  const save = () => {
    if (lines.length === 0) {
      setError(t('mobile.invoices.editNeedLines'));
      return;
    }
    if (nextTotal + 1e-9 < paid) {
      setError(t('mobile.invoices.totalBelowPaid'));
      return;
    }
    const payloadLines = lines.map((l) => ({
      id: l.id,
      description: l.description.trim() || 'Line',
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice) || 0,
      taxRate: percentToStoredTaxRate(l.taxPercent),
    }));
    mutation.mutate(
      {
        notes: notes.trim() || null,
        dueDate: dueDate.trim() || null,
        invoiceDate: invoiceDate.trim() || undefined,
        lines: payloadLines,
        ...(deriveFromLines
          ? {}
          : {
              subtotal: Number(subtotal) || 0,
              taxTotal: Number(tax) || 0,
              total: Number(total) || 0,
            }),
      },
      {
        onSuccess: () => {
          void haptics.confirmMedium();
          onSaved?.();
          onClose();
        },
        onError: (err) => {
          void haptics.error();
          setError(invoiceEditErrorMessage(err, t('mobile.invoices.editFailed')));
        },
      },
    );
  };

  return (
    <>
      <BottomSheet
        open={editVisible}
        onClose={() => {
          if (pendingPicker.current) {
            setEditVisible(false);
            return;
          }
          onClose();
        }}
        onClosed={() => {
          if (!pendingPicker.current) return;
          pendingPicker.current = false;
          setTimeout(() => setPickerOpen(true), 80);
        }}
        title={t('mobile.invoices.editTitle')}
        sheetHeight={Math.min(Math.round(height * 0.88), 760)}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
        >
          <InvoiceFloorBoard title={t('mobile.invoices.editHeader')}>
            <DatePickerField
              label={t('mobile.invoices.invoiceDate')}
              value={invoiceDate}
              onChange={setInvoiceDate}
            />
            <DatePickerField
              label={t('mobile.invoices.dueDate')}
              value={dueDate}
              onChange={setDueDate}
            />
          </InvoiceFloorBoard>

          <InvoiceFloorBoard title={t('mobile.invoices.editMoney')}>
            <AnimatedPressable
              variant="button"
              onPress={() => {
                void haptics.selection();
                setDeriveFromLines((v) => !v);
              }}
              style={{
                minHeight: 44,
                borderRadius: theme.radius.full,
                borderWidth: 1.5,
                borderColor: deriveFromLines ? colors.brand : colors.border,
                backgroundColor: deriveFromLines ? colors.brandSoft : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="caption" weight={titleWeight} color={deriveFromLines ? 'brand' : 'secondary'}>
                {t('mobile.invoices.deriveFromLines')}
              </AppText>
            </AnimatedPressable>
            <QtyStepperField
              label={t('accounting.subtotal')}
              value={deriveFromLines ? String(derived.subtotal) : subtotal}
              onChangeText={setSubtotal}
              disabled={deriveFromLines}
              unit="₪"
              step={1}
              decimals={2}
            />
            <QtyStepperField
              label={t('accounting.tax')}
              value={deriveFromLines ? String(derived.tax) : tax}
              onChangeText={setTax}
              disabled={deriveFromLines}
              unit="₪"
              step={1}
              decimals={2}
            />
            <QtyStepperField
              label={t('accounting.total')}
              value={deriveFromLines ? String(derived.total) : total}
              onChangeText={setTotal}
              disabled={deriveFromLines}
              unit="₪"
              step={1}
              decimals={2}
            />
            <AppText variant="caption" color="muted">
              {t('mobile.invoices.paidReadOnly', { amount: formatCurrency(paid) })}
            </AppText>
          </InvoiceFloorBoard>

          <InvoiceFloorBoard title={t('mobile.invoices.items')}>
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
                    gap: theme.spacing.sm,
                  }}
                >
                  <AnimatedPressable
                    variant="button"
                    accessibilityRole="button"
                    accessibilityLabel={t('mobile.invoices.changeItem')}
                    onPress={() => openPicker(line)}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      justifyContent: 'center',
                    }}
                  >
                    <AppText numberOfLines={1} color={line.description.trim() ? 'primary' : 'muted'}>
                      {line.description.trim() || t('mobile.invoices.lineDescription')}
                    </AppText>
                  </AnimatedPressable>
                  <QtyStepperField
                    label={t('mobile.invoices.qty')}
                    value={line.quantity}
                    onChangeText={(v) =>
                      setLines((prev) =>
                        prev.map((row) => (row.key === line.key ? { ...row, quantity: v } : row)),
                      )
                    }
                    step={1}
                    decimals={2}
                  />
                  <QtyStepperField
                    label={t('mobile.invoices.unitPrice')}
                    value={line.unitPrice}
                    onChangeText={(v) =>
                      setLines((prev) =>
                        prev.map((row) => (row.key === line.key ? { ...row, unitPrice: v } : row)),
                      )
                    }
                    unit="₪"
                    step={1}
                    decimals={2}
                  />
                  <QtyStepperField
                    label={t('mobile.invoices.taxPercent')}
                    value={line.taxPercent}
                    onChangeText={(v) =>
                      setLines((prev) =>
                        prev.map((row) => (row.key === line.key ? { ...row, taxPercent: v } : row)),
                      )
                    }
                    unit="%"
                    step={1}
                    decimals={2}
                  />
                  {lines.length > 1 ? (
                    <InvoiceRowActionChip
                      label={t('common.delete')}
                      icon="trash-outline"
                      tone="danger"
                      onPress={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                    />
                  ) : null}
                </View>
              ))}
              <PrimaryButton
                label={t('mobile.invoices.addItem')}
                onPress={() => openPicker()}
                style={{ borderRadius: theme.radius.full, minHeight: 44 }}
              />
            </View>
          </InvoiceFloorBoard>

          <InvoiceFloorBoard title={t('mobile.invoices.notes')}>
            <TextField
              value={notes}
              onChangeText={setNotes}
              placeholder={t('mobile.invoices.notesPlaceholder')}
              multiline
              numberOfLines={3}
              style={{ minHeight: 88, textAlignVertical: 'top' }}
            />
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
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
          <SecondaryButton
            label={t('common.cancel')}
            onPress={onClose}
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
        </ScrollView>
      </BottomSheet>
      <InvoiceItemPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onClosed={() => {
          editingLineKeyRef.current = null;
          setEditingLineKey(null);
          if (open) setTimeout(() => setEditVisible(true), 80);
        }}
        source="inventory"
        title={editingLineKey ? t('mobile.invoices.changeItem') : t('mobile.invoices.addItem')}
        initialMode={pickerMode}
        initialCustomName={pickerCustomName}
        onPick={applyPick}
      />
    </>
  );
}
