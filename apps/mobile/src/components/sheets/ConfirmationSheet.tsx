import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type ConfirmationSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (reason?: string) => void;
  destructive?: boolean;
  /** Stack on top of another sheet (host yields while open). */
  overlay?: boolean;
  /** Optional reason field (hold / cancel). */
  reasonLabel?: string;
  reasonPlaceholder?: string;
};

export function ConfirmationSheet({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = false,
  overlay = false,
  reasonLabel,
  reasonPlaceholder,
}: ConfirmationSheetProps) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const [reason, setReason] = useState('');
  const withReason = Boolean(reasonLabel);
  const resolvedConfirm = confirmLabel ?? t('common.confirm');
  const resolvedCancel = cancelLabel ?? t('common.cancel');
  const pill = { borderRadius: theme.radius.full } as const;

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      fitContent
      maxHeight={withReason ? 480 : 360}
      overlay={overlay}
    >
      <View
        style={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
        }}
      >
        <AppText
          variant="body"
          color="secondary"
          style={{ textAlign: 'center', lineHeight: 22 }}
        >
          {message}
        </AppText>

        {withReason ? (
          <TextField
            label={reasonLabel}
            value={reason}
            onChangeText={setReason}
            placeholder={reasonPlaceholder}
            multiline
            growMinHeight={72}
          />
        ) : null}

        <View style={{ gap: theme.spacing.md }}>
          {destructive ? (
            <DestructiveButton
              label={resolvedConfirm}
              style={pill}
              onPress={() => {
                onConfirm(withReason ? reason.trim() || undefined : undefined);
                onClose();
              }}
            />
          ) : (
            <PrimaryButton
              label={resolvedConfirm}
              style={pill}
              onPress={() => {
                onConfirm(withReason ? reason.trim() || undefined : undefined);
                onClose();
              }}
            />
          )}
          <SecondaryButton label={resolvedCancel} style={pill} onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}
