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
  /** When true with reasonLabel, confirm stays disabled until reason is non-empty. */
  reasonRequired?: boolean;
  reasonRequiredMessage?: string;
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
  reasonRequired = false,
  reasonRequiredMessage,
}: ConfirmationSheetProps) {
  const { theme } = useTheme();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const withReason = Boolean(reasonLabel);
  const trimmed = reason.trim();
  const missingRequired = reasonRequired && withReason && !trimmed;
  const pill = { borderRadius: theme.radius.xl } as const;

  useEffect(() => {
    if (!open) {
      setReason('');
      setReasonError(false);
    }
  }, [open]);

  const handleConfirm = () => {
    if (missingRequired) {
      setReasonError(true);
      return;
    }
    onConfirm(withReason ? trimmed || undefined : undefined);
    onClose();
  };

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
          <View style={{ gap: theme.spacing.xs }}>
            <TextField
              label={reasonLabel}
              value={reason}
              onChangeText={(next) => {
                setReason(next);
                if (reasonError && next.trim()) setReasonError(false);
              }}
              placeholder={reasonPlaceholder}
              multiline
              growMinHeight={72}
            />
            {reasonError && reasonRequiredMessage ? (
              <AppText variant="caption" color="error">
                {reasonRequiredMessage}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.md }}>
          {destructive ? (
            <DestructiveButton
              label={confirmLabel}
              style={pill}
              onPress={handleConfirm}
              disabled={missingRequired}
            />
          ) : (
            <PrimaryButton
              label={confirmLabel}
              style={pill}
              onPress={handleConfirm}
              disabled={missingRequired}
            />
          )}
          <SecondaryButton label={cancelLabel} style={pill} onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}
