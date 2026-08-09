import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import type { CustomerDetail } from '@/api/modules/customers';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { PhoneField } from '@/components/forms/PhoneField';
import {
  isValidOptionalE164Phone,
  toE164Phone,
} from '@/components/forms/countryDialCodes';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useUpdateDealerMutation } from '../query';
import {
  DealerFormChip,
  DealerFormError,
  DealerFormFooter,
  DealerFormSection,
} from './dealerSheetForm';

type Props = {
  open: boolean;
  onClose: () => void;
  dealer: CustomerDetail;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TYPES = ['COMPANY', 'INDIVIDUAL', 'SHOWROOM'] as const;
const LANGS = ['ar', 'en', 'he'] as const;

/**
 * Edit-dealer sheet — sectioned floor form with type / language chips and pinned footer.
 */
export function EditDealerSheet({ open, onClose, dealer }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.88), 720);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const updateMutation = useUpdateDealerMutation(dealer.id);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    nameHe: '',
    customerType: 'COMPANY',
    companyName: '',
    phone: '',
    fax: '',
    email: '',
    preferredLanguage: 'ar',
    notes: '',
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      nameAr: dealer.nameAr ?? '',
      nameEn: dealer.nameEn ?? '',
      nameHe: dealer.nameHe ?? '',
      customerType: String(dealer.customerType ?? 'COMPANY'),
      companyName: dealer.companyName ?? '',
      phone: dealer.phone ?? '',
      fax: dealer.fax ?? '',
      email: dealer.email ?? '',
      preferredLanguage: dealer.preferredLanguage ?? 'ar',
      notes: dealer.notes ?? '',
    });
    setError(null);
  }, [open, dealer]);

  const entityNameLabel = useMemo(() => {
    if (form.customerType === 'SHOWROOM') return t('customers.showroomName');
    if (form.customerType === 'INDIVIDUAL') return t('customers.individualName');
    return t('customers.companyName');
  }, [form.customerType, t]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async () => {
    setError(null);
    if (!form.nameAr.trim() && !form.nameEn.trim() && !form.nameHe.trim()) {
      setError(t('customers.nameRequired'));
      return;
    }
    if (!isValidOptionalE164Phone(form.phone)) {
      setError(t('customers.invalidPhone'));
      return;
    }
    if (!isValidOptionalE164Phone(form.fax)) {
      setError(t('customers.invalidFax'));
      return;
    }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      setError(t('customers.invalidEmail'));
      return;
    }
    try {
      await updateMutation.mutateAsync({
        nameAr: form.nameAr.trim() || undefined,
        nameEn: form.nameEn.trim() || undefined,
        nameHe: form.nameHe.trim() || undefined,
        customerType: form.customerType,
        companyName:
          form.customerType === 'INDIVIDUAL'
            ? null
            : form.companyName.trim() || null,
        phone: toE164Phone(form.phone) || undefined,
        fax: toE164Phone(form.fax) || null,
        email: form.email.trim() || null,
        preferredLanguage: form.preferredLanguage,
        notes: form.notes.trim() || null,
      });
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('customers.updated') });
      onClose();
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('customers.nameRequired'));
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('customers.edit')}
      sheetHeight={sheetHeight}
    >
      <View style={{ flex: 1, gap: theme.spacing.md }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
          }}
        >
          {/* Type */}
          <DealerFormSection
            icon="storefront-outline"
            label={t('customers.type')}
            titleWeight={titleWeight}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              {TYPES.map((type) => {
                const active = form.customerType === type;
                const label =
                  type === 'INDIVIDUAL'
                    ? t('customers.individual')
                    : type === 'SHOWROOM'
                      ? t('customers.showroom')
                      : t('customers.company');
                return (
                  <DealerFormChip
                    key={type}
                    label={label}
                    active={active}
                    onPress={() => set('customerType', type)}
                  />
                );
              })}
            </View>
          </DealerFormSection>

          {/* Names */}
          <DealerFormSection
            icon="text-outline"
            label={t('customers.name')}
            titleWeight={titleWeight}
          >
            <TextField
              label={t('customers.nameAr')}
              value={form.nameAr}
              onChangeText={(v) => set('nameAr', v)}
            />
            <TextField
              label={t('customers.nameEn')}
              value={form.nameEn}
              onChangeText={(v) => set('nameEn', v)}
            />
            <TextField
              label={t('customers.nameHe')}
              value={form.nameHe}
              onChangeText={(v) => set('nameHe', v)}
            />
            {form.customerType !== 'INDIVIDUAL' ? (
              <TextField
                label={entityNameLabel}
                value={form.companyName}
                onChangeText={(v) => set('companyName', v)}
              />
            ) : null}
          </DealerFormSection>

          {/* Contact */}
          <DealerFormSection
            icon="call-outline"
            label={t('customers.phone')}
            titleWeight={titleWeight}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                textAlign: isRTL ? 'right' : 'left',
                lineHeight: 17,
                marginBottom: 2,
              }}
            >
              {t('customers.phoneHint')}
            </AppText>
            <PhoneField
              label={t('customers.phone')}
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
            />
            <PhoneField
              label={t('customers.fax')}
              value={form.fax}
              onChangeText={(v) => set('fax', v)}
            />
            <TextField
              label={t('customers.email')}
              value={form.email}
              onChangeText={(v) => set('email', v)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </DealerFormSection>

          {/* Language */}
          <DealerFormSection
            icon="language-outline"
            label={t('customers.language')}
            titleWeight={titleWeight}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              {LANGS.map((lang) => {
                const active = form.preferredLanguage === lang;
                const label =
                  lang === 'ar' ? 'العربية' : lang === 'he' ? 'עברית' : 'English';
                return (
                  <DealerFormChip
                    key={lang}
                    label={label}
                    active={active}
                    onPress={() => set('preferredLanguage', lang)}
                  />
                );
              })}
            </View>
          </DealerFormSection>

          {/* Notes */}
          <DealerFormSection
            icon="chatbubble-ellipses-outline"
            label={t('customers.notes')}
            titleWeight={titleWeight}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                textAlign: isRTL ? 'right' : 'left',
                lineHeight: 17,
                marginBottom: 2,
              }}
            >
              {t('customers.notesHint')}
            </AppText>
            <TextField
              label={t('customers.notes')}
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              multiline
              growMaxHeight={160}
            />
          </DealerFormSection>

          {error ? <DealerFormError message={error} /> : null}
        </ScrollView>

        {/* Pinned footer */}
        <DealerFormFooter
          confirmLabel={t('common.save')}
          onConfirm={() => void onSubmit()}
          onCancel={onClose}
          loading={updateMutation.isPending}
        />
      </View>
    </BottomSheet>
  );
}
