import { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { getCustomer, updateCustomerAddress } from '@/api/modules/customers';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { PhoneField } from '@/components/forms/PhoneField';
import {
  isValidE164Phone,
  isValidOptionalE164Phone,
  toE164Phone,
} from '@/components/forms/countryDialCodes';
import { TextField } from '@/components/forms/TextField';
import { LocationMapPicker, LocationPinField, type MapCoords } from '@/components/maps';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useCreateDealerMutation } from '../query';
import {
  DealerFormChip,
  DealerFormError,
  DealerFormFooter,
  DealerFormSection,
} from './dealerSheetForm';

type Props = {
  open: boolean;
  onClose: () => void;
};

type PortalCredentials = {
  username: string;
  temporaryPassword: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPES = ['COMPANY', 'INDIVIDUAL', 'SHOWROOM'] as const;
const LANGS = ['ar', 'en', 'he'] as const;

const empty = () => ({
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
  addressLabel: 'Main',
  addressCity: '',
  portalUsername: '',
  portalPassword: '',
  portalPasswordConfirm: '',
});

/**
 * Create-dealer sheet — sectioned floor boards matching edit dealer.
 * After success, shows portal username + password in a confirmation board.
 */
export function CreateDealerSheet({ open, onClose }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.9), 760);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const createMutation = useCreateDealerMutation();

  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [credentials, setCredentials] = useState<PortalCredentials | null>(null);

  const entityNameLabel = useMemo(() => {
    if (form.customerType === 'SHOWROOM') return t('customers.showroomName');
    if (form.customerType === 'INDIVIDUAL') return t('customers.individualName');
    return t('customers.companyName');
  }, [form.customerType, t]);

  const set = <K extends keyof ReturnType<typeof empty>>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const clearForm = () => {
    setForm(empty());
    setError(null);
    setCoords(null);
    setMapOpen(false);
  };

  const resetAndClose = () => {
    clearForm();
    setCredentials(null);
    onClose();
  };

  const dismissCredentials = () => {
    setCredentials(null);
    clearForm();
    onClose();
    showToast({ variant: 'success', message: t('customers.createdWithPortal') });
  };

  const onSubmit = async () => {
    setError(null);
    if (!form.nameAr.trim() && !form.nameEn.trim() && !form.nameHe.trim()) {
      setError(t('customers.nameRequired'));
      return;
    }
    if (!toE164Phone(form.phone)) {
      setError(t('customers.phoneRequired'));
      return;
    }
    if (!isValidE164Phone(form.phone)) {
      setError(t('customers.invalidPhone'));
      return;
    }
    if (!form.addressCity.trim() || !form.addressLabel.trim()) {
      setError(t('customers.addressRequired'));
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
    const portalUsername = form.portalUsername.trim().toLowerCase();
    if (portalUsername.length < 2) {
      setError(t('customers.portalUsernameRequired'));
      return;
    }
    if (!form.portalPassword) {
      setError(t('customers.portalPasswordRequired'));
      return;
    }
    if (form.portalPassword !== form.portalPasswordConfirm) {
      setError(t('customers.portalPasswordMismatch'));
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        nameAr: form.nameAr.trim() || undefined,
        nameEn: form.nameEn.trim() || undefined,
        nameHe: form.nameHe.trim() || undefined,
        customerType: form.customerType,
        companyName:
          form.customerType === 'COMPANY' || form.customerType === 'SHOWROOM'
            ? form.companyName.trim() || form.nameEn.trim() || form.nameAr.trim() || undefined
            : undefined,
        phone: toE164Phone(form.phone),
        fax: toE164Phone(form.fax) || undefined,
        email: form.email.trim() || undefined,
        preferredLanguage: form.preferredLanguage,
        notes: form.notes.trim() || undefined,
        portalUsername,
        portalPassword: form.portalPassword,
        address: {
          label: form.addressLabel.trim(),
          city: form.addressCity.trim(),
        },
      });

      if (coords) {
        try {
          const detail = await getCustomer(created.id);
          const addr = detail.addresses?.[0];
          if (addr) {
            await updateCustomerAddress(created.id, addr.id, {
              label: addr.label || form.addressLabel.trim(),
              city: addr.city || form.addressCity.trim(),
              street: addr.street || undefined,
              country: addr.country || 'JO',
              isDefaultDelivery: addr.isDefaultDelivery ?? true,
              isDefaultBilling: addr.isDefaultBilling ?? true,
              latitude: coords.latitude,
              longitude: coords.longitude,
            });
          }
        } catch {
          // Dealer was created; pin attach is best-effort.
        }
      }

      void haptics.confirmLight();
      const creds = created.portalCredentials;
      clearForm();
      if (creds?.username && creds.temporaryPassword) {
        setCredentials({
          username: creds.username,
          temporaryPassword: creds.temporaryPassword,
        });
      } else {
        onClose();
        showToast({ variant: 'success', message: t('customers.created') });
      }
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('customers.nameRequired'));
    }
  };

  const formOpen = open && !credentials;
  const credsOpen = Boolean(credentials);

  return (
    <>
      <BottomSheet
        open={formOpen}
        onClose={resetAndClose}
        title={t('customers.add')}
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

            <DealerFormSection
              icon="location-outline"
              label={t('customers.addresses')}
              titleWeight={titleWeight}
            >
              <TextField
                label={t('customers.addressLabel')}
                value={form.addressLabel}
                onChangeText={(v) => set('addressLabel', v)}
              />
              <TextField
                label={t('customers.addressCity')}
                value={form.addressCity}
                onChangeText={(v) => set('addressCity', v)}
              />
              <LocationPinField
                coords={coords}
                onPress={() => setMapOpen(true)}
                onClear={() => setCoords(null)}
                label={t('customers.mapLocation')}
                hint={t('customers.mapLocationHint')}
              />
            </DealerFormSection>

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

            <DealerFormSection
              icon="key-outline"
              label={t('customers.portalCredentials')}
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
                {t('customers.portalCredentialsOnce')}
              </AppText>
              <TextField
                label={t('customers.portalUsername')}
                value={form.portalUsername}
                onChangeText={(v) => set('portalUsername', v)}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="none"
                autoComplete="off"
                importantForAutofill="no"
              />
              <TextField
                label={t('customers.portalPassword')}
                value={form.portalPassword}
                onChangeText={(v) => set('portalPassword', v)}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="oneTimeCode"
                autoComplete="off"
                importantForAutofill="no"
                passwordRules=""
              />
              <TextField
                label={t('customers.portalPasswordConfirm')}
                value={form.portalPasswordConfirm}
                onChangeText={(v) => set('portalPasswordConfirm', v)}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="oneTimeCode"
                autoComplete="off"
                importantForAutofill="no"
                passwordRules=""
              />
            </DealerFormSection>

            {error ? <DealerFormError message={error} /> : null}
          </ScrollView>

          <DealerFormFooter
            confirmLabel={t('customers.add')}
            onConfirm={() => void onSubmit()}
            onCancel={resetAndClose}
            loading={createMutation.isPending}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        open={credsOpen}
        onClose={dismissCredentials}
        title={t('customers.portalCredentials')}
        fitContent
        maxHeight={460}
      >
        <View style={{ gap: theme.spacing.md }}>
          <DealerFormSection
            icon="checkmark-circle-outline"
            label={t('customers.createdWithPortal')}
            titleWeight={titleWeight}
          >
            <CredentialRow
              label={t('customers.portalUsername')}
              value={credentials?.username ?? ''}
            />
            <CredentialRow
              label={t('customers.portalPassword')}
              value={credentials?.temporaryPassword ?? ''}
            />
            <AppText
              variant="caption"
              color="muted"
              style={{
                textAlign: isRTL ? 'right' : 'left',
                lineHeight: 17,
                marginTop: 2,
              }}
            >
              {t('customers.portalCredentialsOnce')}
            </AppText>
          </DealerFormSection>

          <PrimaryButton
            label={t('common.confirm')}
            onPress={dismissCredentials}
            style={{
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
            }}
          />
        </View>
      </BottomSheet>

      <LocationMapPicker
        open={mapOpen}
        initial={coords}
        title={t('customers.mapLocation')}
        hint={t('customers.mapLocationHint')}
        onClose={() => setMapOpen(false)}
        onConfirm={(next) => {
          setCoords(next);
          setMapOpen(false);
        }}
        onClear={() => setCoords(null)}
      />
    </>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        gap: 4,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText
        variant="body"
        weight="semibold"
        dir="ltr"
        selectable
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {value}
      </AppText>
    </View>
  );
}
