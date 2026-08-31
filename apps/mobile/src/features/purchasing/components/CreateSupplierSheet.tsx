import { useEffect, useState } from 'react';
import { ScrollView, Switch, useWindowDimensions, View } from 'react-native';
import { isApiError } from '@/api/errors';
import type { Supplier } from '@/api/modules/purchasing';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useCreateSupplierMutation, useUpdateSupplierMutation } from '../query';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (supplier: { id: string; name: string }) => void;
  onUpdated?: (supplier: { id: string; name: string }) => void;
  /** Stack on top of another sheet (e.g. New PO). */
  overlay?: boolean;
  mode?: 'create' | 'edit';
  supplier?: Supplier | null;
};

const empty = () => ({
  nameEn: '',
  nameAr: '',
  nameHe: '',
  companyName: '',
  phone: '',
  whatsappPhone: '',
  email: '',
  address: '',
  paymentTermsDays: '30',
  leadTimeDays: '7',
  rating: '',
  isCertified: true,
  notes: '',
});

function formFromSupplier(supplier: Supplier) {
  return {
    nameEn: supplier.nameEn ?? '',
    nameAr: supplier.nameAr ?? '',
    nameHe: supplier.nameHe ?? '',
    companyName: supplier.companyName ?? '',
    phone: supplier.phone ?? '',
    whatsappPhone: supplier.whatsappPhone ?? '',
    email: supplier.email ?? '',
    address: supplier.address ?? '',
    paymentTermsDays: String(supplier.paymentTermsDays ?? 30),
    leadTimeDays: String(supplier.leadTimeDays ?? 7),
    rating: supplier.rating != null ? String(supplier.rating) : '',
    isCertified: supplier.isCertified !== false,
    notes: supplier.notes ?? '',
  };
}

export function CreateSupplierSheet({
  open,
  onClose,
  onCreated,
  onUpdated,
  overlay = false,
  mode = 'create',
  supplier = null,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const createMutation = useCreateSupplierMutation();
  const updateMutation = useUpdateSupplierMutation();
  const [form, setForm] = useState(empty);
  const sheetHeight = Math.min(Math.round(height * 0.88), 720);
  const isEdit = mode === 'edit' && Boolean(supplier?.id);
  const pending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) {
      setForm(empty());
      return;
    }
    if (mode === 'edit' && supplier) setForm(formFromSupplier(supplier));
    else setForm(empty());
  }, [open, mode, supplier?.id]);

  const set = <K extends keyof ReturnType<typeof empty>>(key: K, value: ReturnType<typeof empty>[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dismiss = () => {
    setForm(empty());
    onClose();
  };

  const submit = async () => {
    if (!form.nameEn.trim() && !form.nameAr.trim() && !form.nameHe.trim()) {
      showToast({ variant: 'error', message: t('catalog.nameEn') });
      return;
    }
    const body = {
      name: form.nameEn.trim() || form.nameAr.trim() || form.nameHe.trim(),
      nameEn: form.nameEn.trim() || undefined,
      nameAr: form.nameAr.trim() || undefined,
      nameHe: form.nameHe.trim() || undefined,
      companyName: form.companyName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      whatsappPhone: form.whatsappPhone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      paymentTermsDays: Number(form.paymentTermsDays) || 30,
      leadTimeDays: Number(form.leadTimeDays) || 7,
      rating: form.rating.trim() ? Number(form.rating) : undefined,
      isCertified: form.isCertified,
      notes: form.notes.trim() || undefined,
    };
    try {
      if (isEdit && supplier) {
        const row = await updateMutation.mutateAsync({ id: supplier.id, body });
        void haptics.confirmLight();
        showToast({ variant: 'success', message: t('catalog.supplierUpdated') });
        const name =
          row.nameEn || row.nameAr || row.name || form.nameEn || form.nameAr || '—';
        onUpdated?.({ id: row.id, name });
        dismiss();
        return;
      }
      const row = await createMutation.mutateAsync(body);
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('catalog.supplierCreated') });
      const name =
        row.nameEn || row.nameAr || row.name || form.nameEn || form.nameAr || '—';
      onCreated?.({ id: row.id, name });
      dismiss();
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.purchasing.createFailed'),
      });
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      title={isEdit ? t('mobile.purchasing.editSupplier') : t('catalog.newSupplier')}
      sheetHeight={sheetHeight}
      overlay={overlay}
    >
      <View style={{ flex: 1, minHeight: 0, gap: theme.spacing.md }}>
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <TextField
            label={t('catalog.nameEn')}
            value={form.nameEn}
            onChangeText={(v) => set('nameEn', v)}
          />
          <TextField
            label={t('catalog.nameAr')}
            value={form.nameAr}
            onChangeText={(v) => set('nameAr', v)}
          />
          <TextField
            label={t('catalog.nameHe')}
            value={form.nameHe}
            onChangeText={(v) => set('nameHe', v)}
          />
          <TextField
            label={t('catalog.company')}
            value={form.companyName}
            onChangeText={(v) => set('companyName', v)}
          />
          <TextField
            label={t('catalog.phone')}
            value={form.phone}
            onChangeText={(v) => set('phone', v)}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('catalog.whatsappPhone')}
            value={form.whatsappPhone}
            onChangeText={(v) => set('whatsappPhone', v)}
            keyboardType="phone-pad"
            hint={t('catalog.whatsappPhoneHint')}
          />
          <TextField
            label={t('catalog.email')}
            value={form.email}
            onChangeText={(v) => set('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label={t('common.address')}
            value={form.address}
            onChangeText={(v) => set('address', v)}
          />
          <TextField
            label={t('catalog.paymentTermsDays')}
            value={form.paymentTermsDays}
            onChangeText={(v) => set('paymentTermsDays', v)}
            keyboardType="number-pad"
          />
          <TextField
            label={t('catalog.leadTimeDays')}
            value={form.leadTimeDays}
            onChangeText={(v) => set('leadTimeDays', v)}
            keyboardType="number-pad"
          />
          <TextField
            label={t('catalog.rating')}
            value={form.rating}
            onChangeText={(v) => set('rating', v)}
            keyboardType="decimal-pad"
          />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
            }}
          >
            <AppText style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
              {t('catalog.isCertified')}
            </AppText>
            <Switch
              value={form.isCertified}
              onValueChange={(v) => set('isCertified', v)}
              trackColor={{ false: colors.border, true: colors.brandSoft }}
              thumbColor={form.isCertified ? colors.brand : colors.surfaceSecondary}
            />
          </View>
          <TextField
            label={t('catalog.notes')}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            multiline
          />
        </ScrollView>
        <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
          <PrimaryButton
            label={t('common.save')}
            loading={pending}
            onPress={() => void submit()}
            style={{ borderRadius: theme.radius.xl }}
          />
          <SecondaryButton
            label={t('common.cancel')}
            onPress={dismiss}
            style={{ borderRadius: theme.radius.xl }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
