import { useEffect, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { PhoneField } from '@/components/forms/PhoneField';
import {
  isValidOptionalE164Phone,
  toE164Phone,
} from '@/components/forms/countryDialCodes';
import { TextField } from '@/components/forms/TextField';
import { LocationMapPicker, LocationPinField, type MapCoords } from '@/components/maps';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  useAddDealerAddressMutation,
  useAddDealerContactMutation,
  useAddDealerNoteMutation,
  useDeleteDealerAddressMutation,
  useUpdateDealerAddressMutation,
  useUpdateDealerMutation,
  useUpdateDealerNoteMutation,
} from '../query';
import {
  DealerFormChip,
  DealerFormError,
  DealerFormFooter,
  DealerFormSection,
} from './dealerSheetForm';
import type { CustomerAddress } from '@/api/modules/customers';

export { AddPriceSheet } from './AddPriceSheet';

type BaseProps = {
  open: boolean;
  onClose: () => void;
  customerId: string;
};

type AddressDefaults = {
  id: string;
  label?: string | null;
  isDefaultDelivery?: boolean;
  isDefaultBilling?: boolean;
};

type AddAddressProps = BaseProps & {
  /** Existing addresses — used to explain exclusive default delivery / billing. */
  existingAddresses?: AddressDefaults[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Add contact — sectioned floor form with pinned footer.
 */
export function AddContactSheet({ open, onClose, customerId }: BaseProps) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.78), 580);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mutation = useAddDealerContactMutation(customerId);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setPhone('');
    setEmail('');
    setPosition('');
    setError(null);
    onClose();
  };

  const onSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError(t('customers.contactNameRequired'));
      return;
    }
    if (!isValidOptionalE164Phone(phone)) {
      setError(t('customers.invalidPhone'));
      return;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setError(t('customers.invalidEmail'));
      return;
    }
    try {
      await mutation.mutateAsync({
        name: name.trim(),
        phone: toE164Phone(phone) || undefined,
        email: email.trim() || undefined,
        position: position.trim() || undefined,
      });
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('customers.contactCreated') });
      reset();
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('customers.contactNameRequired'));
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={reset}
      title={t('customers.addContact')}
      sheetHeight={sheetHeight}
    >
      <View style={{ flex: 1, gap: theme.spacing.md }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <DealerFormSection
            icon="person-outline"
            label={t('customers.contactName')}
            titleWeight={titleWeight}
          >
            <TextField
              label={t('customers.contactName')}
              value={name}
              onChangeText={setName}
            />
            <TextField
              label={t('customers.position')}
              value={position}
              onChangeText={setPosition}
            />
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
            <PhoneField label={t('customers.phone')} value={phone} onChangeText={setPhone} />
            <TextField
              label={t('customers.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </DealerFormSection>

          {error ? <DealerFormError message={error} /> : null}
        </ScrollView>

        <DealerFormFooter
          confirmLabel={t('customers.addContact')}
          onConfirm={() => void onSubmit()}
          onCancel={reset}
          loading={mutation.isPending}
        />
      </View>
    </BottomSheet>
  );
}

/**
 * Add address — sectioned floor form with map pin + exclusive default chips.
 * Only one address per customer may be default delivery; only one default billing
 * (same address may hold both). Server clears the previous holder when set.
 */
export function AddAddressSheet({
  open,
  onClose,
  customerId,
  existingAddresses = [],
}: AddAddressProps) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.86), 640);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mutation = useAddDealerAddressMutation(customerId);
  const [label, setLabel] = useState('Delivery');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [defaultDelivery, setDefaultDelivery] = useState(true);
  const [defaultBilling, setDefaultBilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [coords, setCoords] = useState<MapCoords | null>(null);

  const currentDelivery = existingAddresses.find((a) => a.isDefaultDelivery);
  const currentBilling = existingAddresses.find((a) => a.isDefaultBilling);
  const hasAnyAddress = existingAddresses.length > 0;
  const deliveryHolderId = currentDelivery?.id ?? null;
  const billingHolderId = currentBilling?.id ?? null;
  const deliveryLocked = Boolean(deliveryHolderId);
  const billingLocked = Boolean(billingHolderId);

  useEffect(() => {
    if (!open) return;
    // First address: both defaults. Later: only free flags (locked ones stay off).
    if (!hasAnyAddress) {
      setDefaultDelivery(true);
      setDefaultBilling(true);
    } else {
      setDefaultDelivery(false);
      setDefaultBilling(false);
    }
  }, [open, hasAnyAddress]);

  const reset = () => {
    setLabel('Delivery');
    setCity('');
    setStreet('');
    setDefaultDelivery(true);
    setDefaultBilling(false);
    setError(null);
    setCoords(null);
    setMapOpen(false);
    onClose();
  };

  const onSubmit = async () => {
    setError(null);
    if (!label.trim() || !city.trim()) {
      setError(t('customers.addressRequired'));
      return;
    }
    try {
      await mutation.mutateAsync({
        label: label.trim(),
        city: city.trim(),
        street: street.trim() || undefined,
        country: 'JO',
        isDefaultDelivery: deliveryLocked ? false : defaultDelivery,
        isDefaultBilling: billingLocked ? false : defaultBilling,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('customers.addressCreated') });
      reset();
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('customers.addressRequired'));
    }
  };

  const defaultsHint = (() => {
    const v = t('customers.addressDefaultsHint');
    return v === 'customers.addressDefaultsHint'
      ? 'Only one address can be default delivery, and only one can be default billing. The same address may have both. Options already used by another address are locked.'
      : v;
  })();

  const deliveryLockedHint =
    deliveryLocked && currentDelivery
      ? (() => {
          const v = t('customers.defaultDeliveryLocked', {
            label: currentDelivery.label || '—',
          });
          return v === 'customers.defaultDeliveryLocked'
            ? `Default delivery is on “${currentDelivery.label || '—'}” — unlock it there first.`
            : v;
        })()
      : null;

  const billingLockedHint =
    billingLocked && currentBilling
      ? (() => {
          const v = t('customers.defaultBillingLocked', {
            label: currentBilling.label || '—',
          });
          return v === 'customers.defaultBillingLocked'
            ? `Default billing is on “${currentBilling.label || '—'}” — unlock it there first.`
            : v;
        })()
      : null;

  return (
    <>
      <BottomSheet
        open={open}
        onClose={reset}
        title={t('customers.addAddress')}
        sheetHeight={sheetHeight}
      >
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
          >
            <DealerFormSection
              icon="location-outline"
              label={t('customers.addresses')}
              titleWeight={titleWeight}
            >
              <TextField label={t('customers.label')} value={label} onChangeText={setLabel} />
              <TextField label={t('customers.city')} value={city} onChangeText={setCity} />
              <TextField label={t('customers.street')} value={street} onChangeText={setStreet} />
            </DealerFormSection>

            <DealerFormSection
              icon="map-outline"
              label={t('customers.mapLocation')}
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
                {t('customers.mapLocationHint')}
              </AppText>
              <LocationPinField
                coords={coords}
                onPress={() => setMapOpen(true)}
                onClear={() => setCoords(null)}
                label={t('customers.mapLocation')}
                hint={t('customers.mapLocationHint')}
              />
            </DealerFormSection>

            <DealerFormSection
              icon="flag-outline"
              label={(() => {
                const v = t('customers.addressDefaults');
                return v === 'customers.addressDefaults' ? 'Defaults' : v;
              })()}
              titleWeight={titleWeight}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  lineHeight: 17,
                }}
              >
                {defaultsHint}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                <DealerFormChip
                  label={t('customers.defaultDelivery')}
                  active={defaultDelivery && !deliveryLocked}
                  disabled={deliveryLocked}
                  onPress={() => setDefaultDelivery((v) => !v)}
                />
                <DealerFormChip
                  label={t('customers.defaultBilling')}
                  active={defaultBilling && !billingLocked}
                  disabled={billingLocked}
                  onPress={() => setDefaultBilling((v) => !v)}
                />
              </View>
              {deliveryLockedHint ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}
                >
                  {deliveryLockedHint}
                </AppText>
              ) : null}
              {billingLockedHint ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}
                >
                  {billingLockedHint}
                </AppText>
              ) : null}
            </DealerFormSection>

            {error ? <DealerFormError message={error} /> : null}
          </ScrollView>

          <DealerFormFooter
            confirmLabel={t('customers.addAddress')}
            onConfirm={() => void onSubmit()}
            onCancel={reset}
            loading={mutation.isPending}
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

type EditAddressProps = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  address: CustomerAddress | null;
  existingAddresses?: AddressDefaults[];
};

/**
 * Edit address — same floor sections as add; exclusive defaults exclude self.
 */
export function EditAddressSheet({
  open,
  onClose,
  customerId,
  address,
  existingAddresses = [],
}: EditAddressProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.86), 640);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mutation = useUpdateDealerAddressMutation(customerId);
  const deleteMutation = useDeleteDealerAddressMutation(customerId);
  const [label, setLabel] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [defaultDelivery, setDefaultDelivery] = useState(false);
  const [defaultBilling, setDefaultBilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const others = existingAddresses.filter((a) => a.id !== address?.id);
  const currentDelivery = others.find((a) => a.isDefaultDelivery);
  const currentBilling = others.find((a) => a.isDefaultBilling);
  // Locked only when another address owns it and this one does not.
  const deliveryLocked =
    Boolean(currentDelivery) && !Boolean(address?.isDefaultDelivery);
  const billingLocked =
    Boolean(currentBilling) && !Boolean(address?.isDefaultBilling);

  useEffect(() => {
    if (!open || !address) return;
    setLabel(address.label?.trim() || '');
    setCity(address.city?.trim() || '');
    setStreet((address.street || address.line1 || '').trim());
    setDefaultDelivery(Boolean(address.isDefaultDelivery));
    setDefaultBilling(Boolean(address.isDefaultBilling));
    setCoords(
      address.latitude != null && address.longitude != null
        ? { latitude: Number(address.latitude), longitude: Number(address.longitude) }
        : null,
    );
    setError(null);
    setMapOpen(false);
    setConfirmDeleteOpen(false);
  }, [open, address]);

  const reset = () => {
    setError(null);
    setMapOpen(false);
    setConfirmDeleteOpen(false);
    onClose();
  };

  const onSubmit = async () => {
    if (!address) return;
    setError(null);
    if (!label.trim() || !city.trim()) {
      setError(t('customers.addressRequired'));
      return;
    }
    try {
      await mutation.mutateAsync({
        addressId: address.id,
        body: {
          label: label.trim(),
          city: city.trim(),
          street: street.trim() || undefined,
          country: address.country?.trim() || 'JO',
          isDefaultDelivery: deliveryLocked ? false : defaultDelivery,
          isDefaultBilling: billingLocked ? false : defaultBilling,
          latitude: coords ? coords.latitude : null,
          longitude: coords ? coords.longitude : null,
        },
      });
      void haptics.confirmLight();
      const updatedMsg = t('customers.addressUpdated');
      showToast({
        variant: 'success',
        message:
          updatedMsg === 'customers.addressUpdated' ? 'Address updated.' : updatedMsg,
      });
      reset();
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('customers.addressRequired'));
    }
  };

  const onDelete = async () => {
    if (!address) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync(address.id);
      void haptics.confirmLight();
      const deletedMsg = t('customers.addressDeleted');
      showToast({
        variant: 'success',
        message:
          deletedMsg === 'customers.addressDeleted' ? 'Address deleted.' : deletedMsg,
      });
      reset();
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('common.error'));
    }
  };

  const editTitle = (() => {
    const v = t('customers.editAddress');
    return v === 'customers.editAddress' ? 'Edit address' : v;
  })();

  const deleteLabel = (() => {
    const v = t('customers.deleteAddress');
    return v === 'customers.deleteAddress' ? 'Delete address' : v;
  })();

  const deleteConfirmMsg = (() => {
    const v = t('customers.deleteAddressConfirm');
    return v === 'customers.deleteAddressConfirm'
      ? 'Remove this address from the dealer?'
      : v;
  })();

  const defaultsHint = (() => {
    const v = t('customers.addressDefaultsHint');
    return v === 'customers.addressDefaultsHint'
      ? 'Only one address can be default delivery, and only one can be default billing. The same address may have both. Options already used by another address are locked.'
      : v;
  })();

  const deliveryLockedHint =
    deliveryLocked && currentDelivery
      ? (() => {
          const v = t('customers.defaultDeliveryLocked', {
            label: currentDelivery.label || '—',
          });
          return v === 'customers.defaultDeliveryLocked'
            ? `Default delivery is on “${currentDelivery.label || '—'}” — unlock it there first.`
            : v;
        })()
      : null;

  const billingLockedHint =
    billingLocked && currentBilling
      ? (() => {
          const v = t('customers.defaultBillingLocked', {
            label: currentBilling.label || '—',
          });
          return v === 'customers.defaultBillingLocked'
            ? `Default billing is on “${currentBilling.label || '—'}” — unlock it there first.`
            : v;
        })()
      : null;

  return (
    <>
      <BottomSheet open={open} onClose={reset} title={editTitle} sheetHeight={sheetHeight}>
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
          >
            <DealerFormSection
              icon="location-outline"
              label={t('customers.addresses')}
              titleWeight={titleWeight}
            >
              <TextField label={t('customers.label')} value={label} onChangeText={setLabel} />
              <TextField label={t('customers.city')} value={city} onChangeText={setCity} />
              <TextField label={t('customers.street')} value={street} onChangeText={setStreet} />
            </DealerFormSection>

            <DealerFormSection
              icon="map-outline"
              label={t('customers.mapLocation')}
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
                {t('customers.mapLocationHint')}
              </AppText>
              <LocationPinField
                coords={coords}
                onPress={() => setMapOpen(true)}
                onClear={() => setCoords(null)}
                label={t('customers.mapLocation')}
                hint={t('customers.mapLocationHint')}
              />
            </DealerFormSection>

            <DealerFormSection
              icon="flag-outline"
              label={(() => {
                const v = t('customers.addressDefaults');
                return v === 'customers.addressDefaults' ? 'Defaults' : v;
              })()}
              titleWeight={titleWeight}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  lineHeight: 17,
                }}
              >
                {defaultsHint}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                <DealerFormChip
                  label={t('customers.defaultDelivery')}
                  active={defaultDelivery && !deliveryLocked}
                  disabled={deliveryLocked}
                  onPress={() => setDefaultDelivery((v) => !v)}
                />
                <DealerFormChip
                  label={t('customers.defaultBilling')}
                  active={defaultBilling && !billingLocked}
                  disabled={billingLocked}
                  onPress={() => setDefaultBilling((v) => !v)}
                />
              </View>
              {deliveryLockedHint ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}
                >
                  {deliveryLockedHint}
                </AppText>
              ) : null}
              {billingLockedHint ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}
                >
                  {billingLockedHint}
                </AppText>
              ) : null}
            </DealerFormSection>

            {error ? <DealerFormError message={error} /> : null}
          </ScrollView>

          <View
            style={{
              gap: theme.spacing.sm,
              paddingTop: theme.spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <PrimaryButton
              label={t('common.save')}
              onPress={() => void onSubmit()}
              loading={mutation.isPending}
              disabled={deleteMutation.isPending}
              style={{
                borderRadius: theme.radius.full,
                minHeight: theme.sizes.touch.min,
                paddingVertical: 0,
              }}
            />
            <DestructiveButton
              label={deleteLabel}
              onPress={() => setConfirmDeleteOpen(true)}
              loading={deleteMutation.isPending}
              disabled={mutation.isPending || deleteMutation.isPending}
              style={{
                borderRadius: theme.radius.full,
                minHeight: theme.sizes.touch.min,
                paddingVertical: 0,
              }}
            />
            <SecondaryButton
              label={t('common.cancel')}
              onPress={reset}
              disabled={mutation.isPending || deleteMutation.isPending}
              style={{
                borderRadius: theme.radius.full,
                minHeight: theme.sizes.touch.min,
                paddingVertical: 0,
              }}
            />
          </View>
        </View>
      </BottomSheet>

      <ConfirmationSheet
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title={deleteLabel}
        message={deleteConfirmMsg}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        overlay
        onConfirm={() => {
          void onDelete();
        }}
      />

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

/**
 * Add note — sectioned floor form with pinned footer.
 */
export function AddNoteSheet({ open, onClose, customerId }: BaseProps) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.62), 460);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mutation = useAddDealerNoteMutation(customerId);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSummary('');
    setError(null);
    onClose();
  };

  const onSubmit = async () => {
    setError(null);
    if (!summary.trim()) {
      setError(t('customers.noteSummaryRequired'));
      return;
    }
    try {
      await mutation.mutateAsync(summary.trim());
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('customers.noteCreated') });
      reset();
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('customers.noteSummaryRequired'));
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={reset}
      title={t('customers.addNote')}
      sheetHeight={sheetHeight}
    >
      <View style={{ flex: 1, gap: theme.spacing.md }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
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
              label={t('customers.noteSummary')}
              value={summary}
              onChangeText={setSummary}
              multiline
              growMaxHeight={180}
              growMinHeight={120}
            />
          </DealerFormSection>

          {error ? <DealerFormError message={error} /> : null}
        </ScrollView>

        <DealerFormFooter
          confirmLabel={t('customers.addNote')}
          onConfirm={() => void onSubmit()}
          onCancel={reset}
          loading={mutation.isPending}
        />
      </View>
    </BottomSheet>
  );
}

type ViewNoteSheetProps = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  /** Communication note id — required when kind is `note`. */
  noteId?: string | null;
  body: string;
  dateLabel?: string | null;
  authorLabel?: string | null;
  /** Profile notes vs communication note. */
  kind?: 'profile' | 'note';
  canEdit?: boolean;
  /** Called after a successful save with the new body. */
  onSaved?: (next: string) => void;
};

/**
 * Read / edit a note — floor board body with scroll; Edit matches Save/Cancel pills.
 */
export function ViewNoteSheet({
  open,
  onClose,
  customerId,
  noteId,
  body,
  dateLabel,
  authorLabel,
  kind = 'note',
  canEdit = false,
  onSaved,
}: ViewNoteSheetProps) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const maxHeight = Math.min(Math.round(height * 0.78), 620);
  const editSheetHeight = Math.min(Math.round(height * 0.72), 520);
  const bodyScrollMax = Math.round(height * 0.42);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const title =
    kind === 'profile' ? t('customers.profileNotes') : t('customers.notes');
  const editTitle = (() => {
    const v = t('customers.editNote');
    return v === 'customers.editNote' ? 'Edit note' : v;
  })();

  const updateNote = useUpdateDealerNoteMutation(customerId);
  const updateDealer = useUpdateDealerMutation(customerId);
  const [editing, setEditing] = useState(false);
  const [displayBody, setDisplayBody] = useState(body);
  const [draft, setDraft] = useState(body);
  const [error, setError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  const saving = updateNote.isPending || updateDealer.isPending;
  const metaBits = [dateLabel, authorLabel].filter(Boolean);

  // Sync content only when the sheet opens — do not reset while editing
  // (body updates from refetch would otherwise discard the draft / kill Save).
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDisplayBody(body);
      setDraft(body);
      setEditing(false);
      setError(null);
    }
    if (!open) {
      setEditing(false);
      setError(null);
    }
    wasOpenRef.current = open;
  }, [open, body]);

  const closeAll = () => {
    setEditing(false);
    setError(null);
    onClose();
  };

  const cancelEdit = () => {
    setDraft(displayBody);
    setError(null);
    setEditing(false);
  };

  const onSave = async () => {
    setError(null);
    const next = draft.trim();
    if (!next) {
      setError(t('customers.noteSummaryRequired'));
      return;
    }
    try {
      if (kind === 'profile') {
        await updateDealer.mutateAsync({ notes: next });
      } else {
        if (!noteId) {
          setError(t('common.error'));
          return;
        }
        await updateNote.mutateAsync({ noteId, summary: next });
      }
      void haptics.confirmLight();
      const updatedMsg = t('customers.noteUpdated');
      showToast({
        variant: 'success',
        message: updatedMsg === 'customers.noteUpdated' ? 'Note updated.' : updatedMsg,
      });
      setDisplayBody(next);
      setDraft(next);
      setEditing(false);
      onSaved?.(next);
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('common.error'));
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={closeAll}
      title={editing ? editTitle : title}
      fitContent={!editing}
      sheetHeight={editing ? editSheetHeight : undefined}
      maxHeight={maxHeight}
    >
      <View style={{ flex: editing ? 1 : undefined, gap: theme.spacing.md }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={editing ? { flex: 1 } : { maxHeight: bodyScrollMax }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <DealerFormSection
            icon="chatbubble-ellipses-outline"
            label={editing ? editTitle : title}
            titleWeight={titleWeight}
          >
            {!editing && metaBits.length ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.sm,
                  alignItems: 'center',
                }}
              >
                {metaBits.map((bit) => (
                  <View
                    key={String(bit)}
                    style={{
                      paddingHorizontal: theme.spacing.sm + 2,
                      paddingVertical: 5,
                      borderRadius: theme.radius.full,
                      backgroundColor: colors.brandSoft,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <AppText
                      variant="caption"
                      weight="semibold"
                      dir="ltr"
                      style={{ color: colors.brand, fontSize: 11 }}
                    >
                      {bit}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}

            {editing ? (
              <>
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
                  label={t('customers.noteSummary')}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  growMaxHeight={180}
                  growMinHeight={120}
                />
              </>
            ) : (
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  padding: theme.spacing.md,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <AppText
                  variant="body"
                  style={{
                    textAlign: isRTL ? 'right' : 'left',
                    lineHeight: 22,
                    color: colors.textPrimary,
                  }}
                >
                  {displayBody.trim() || '—'}
                </AppText>
              </View>
            )}
          </DealerFormSection>
        </ScrollView>

        {error ? <DealerFormError message={error} /> : null}

        <View
          style={{
            gap: theme.spacing.sm,
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {editing ? (
            <>
              <PrimaryButton
                label={t('common.save')}
                onPress={() => void onSave()}
                loading={saving}
                style={{
                  borderRadius: theme.radius.full,
                  minHeight: theme.sizes.touch.min,
                  paddingVertical: 0,
                }}
              />
              <SecondaryButton
                label={t('common.cancel')}
                onPress={cancelEdit}
                disabled={saving}
                style={{
                  borderRadius: theme.radius.full,
                  minHeight: theme.sizes.touch.min,
                  paddingVertical: 0,
                }}
              />
            </>
          ) : (
            <>
              {canEdit ? (
                <>
                  <PrimaryButton
                    label={t('common.edit')}
                    onPress={() => {
                      void haptics.selection();
                      setDraft(displayBody);
                      setError(null);
                      setEditing(true);
                    }}
                    style={{
                      borderRadius: theme.radius.full,
                      minHeight: theme.sizes.touch.min,
                      paddingVertical: 0,
                    }}
                  />
                  <SecondaryButton
                    label={t('common.close')}
                    onPress={() => {
                      void haptics.selection();
                      closeAll();
                    }}
                    style={{
                      borderRadius: theme.radius.full,
                      minHeight: theme.sizes.touch.min,
                      paddingVertical: 0,
                    }}
                  />
                </>
              ) : (
                <PrimaryButton
                  label={t('common.close')}
                  onPress={() => {
                    void haptics.selection();
                    closeAll();
                  }}
                  style={{
                    borderRadius: theme.radius.full,
                    minHeight: theme.sizes.touch.min,
                    paddingVertical: 0,
                  }}
                />
              )}
            </>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}
