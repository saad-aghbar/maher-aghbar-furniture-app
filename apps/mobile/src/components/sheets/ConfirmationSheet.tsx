import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
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
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
  overlay = false,
  reasonLabel,
  reasonPlaceholder,
}: ConfirmationSheetProps) {
  const { theme } = useTheme();
  const [reason, setReason] = useState('');
  const withReason = Boolean(reasonLabel);

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      sheetHeight={withReason ? 420 : 280}
      overlay={overlay}
    >
      <AppText variant="body" color="secondary" style={{ marginBottom: theme.spacing.md }}>
        {message}
      </AppText>
      {withReason ? (
        <View style={{ marginBottom: theme.spacing.lg }}>
          <TextField
            label={reasonLabel}
            value={reason}
            onChangeText={setReason}
            placeholder={reasonPlaceholder}
            multiline
            growMinHeight={72}
          />
        </View>
      ) : (
        <View style={{ marginBottom: theme.spacing.xl }} />
      )}
      <View style={{ gap: theme.spacing.sm }}>
        {destructive ? (
          <DestructiveButton
            label={confirmLabel}
            onPress={() => {
              onConfirm(withReason ? reason.trim() || undefined : undefined);
              onClose();
            }}
          />
        ) : (
          <PrimaryButton
            label={confirmLabel}
            onPress={() => {
              onConfirm(withReason ? reason.trim() || undefined : undefined);
              onClose();
            }}
          />
        )}
        <SecondaryButton label={cancelLabel} onPress={onClose} />
      </View>
    </BottomSheet>
  );
}
