import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { useDeleteDealerMutation } from '../query';
import { DealerFormError, DealerFormSection } from './dealerSheetForm';

type Props = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  dealerName: string;
  onDeleted: () => void;
};

/**
 * Confirms dealer deletion by re-entering that dealer’s portal username + password.
 */
export function DeleteDealerSheet({
  open,
  onClose,
  customerId,
  dealerName,
  onDeleted,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const deleteMutation = useDeleteDealerMutation(customerId);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUsername('');
      setPassword('');
      setError(null);
    }
  }, [open]);

  const title = (() => {
    const v = t('customers.deleteDealer');
    return v === 'customers.deleteDealer' ? 'Delete dealer' : v;
  })();

  const hint = (() => {
    const v = t('customers.deleteDealerHint');
    return v === 'customers.deleteDealerHint'
      ? 'Type this dealer’s portal username and password to permanently remove them from the list.'
      : v;
  })();

  const confirmLabel = (() => {
    const v = t('customers.deleteDealerConfirm');
    return v === 'customers.deleteDealerConfirm' ? 'Delete dealer' : v;
  })();

  const onSubmit = async () => {
    setError(null);
    if (!username.trim()) {
      setError(t('customers.portalUsernameRequired'));
      return;
    }
    if (!password) {
      setError(t('customers.portalPasswordRequired'));
      return;
    }

    try {
      await deleteMutation.mutateAsync({
        portalUsername: username.trim(),
        portalPassword: password,
      });
      const ok = t('customers.deleted');
      showToast({
        variant: 'success',
        message: ok === 'customers.deleted' ? 'Dealer deleted.' : ok,
      });
      onClose();
      onDeleted();
    } catch (err) {
      if (isApiError(err) && err.code === 'INVALID_PORTAL_CREDENTIALS') {
        const msg = t('customers.deleteDealerBadCredentials');
        setError(
          msg === 'customers.deleteDealerBadCredentials'
            ? 'Dealer username or password is incorrect.'
            : msg,
        );
        return;
      }
      setError(toastMessageForError(err, t));
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={title} sheetHeight={520}>
      <View style={{ flex: 1, gap: theme.spacing.md }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <DealerFormSection icon="warning-outline" label={dealerName || title} titleWeight={titleWeight}>
            <AppText
              variant="body"
              color="secondary"
              style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 22 }}
            >
              {hint}
            </AppText>
            <TextField
              label={t('customers.portalUsername')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="none"
              autoComplete="off"
              importantForAutofill="no"
            />
            <TextField
              label={t('customers.portalPassword')}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="oneTimeCode"
              autoComplete="off"
              importantForAutofill="no"
              passwordRules=""
            />
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
          <DestructiveButton
            label={confirmLabel}
            onPress={() => void onSubmit()}
            loading={deleteMutation.isPending}
            style={{
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
            }}
          />
          <SecondaryButton
            label={t('common.cancel')}
            onPress={onClose}
            disabled={deleteMutation.isPending}
            style={{
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
