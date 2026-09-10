import { View } from 'react-native';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { returnCtaStyle } from './returnFloorCta';

type Props = {
  confirmLabel: string;
  onConfirm: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
};

export function ReturnSheetFooter({
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel,
  loading,
  disabled,
  destructive,
}: Props) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const pill = returnCtaStyle(theme);

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {destructive ? (
        <DestructiveButton
          label={confirmLabel}
          onPress={onConfirm}
          loading={loading}
          disabled={disabled}
          style={pill}
        />
      ) : (
        <PrimaryButton
          label={confirmLabel}
          onPress={onConfirm}
          loading={loading}
          disabled={disabled}
          style={pill}
        />
      )}
      {onCancel ? (
        <SecondaryButton
          label={cancelLabel ?? t('common.cancel')}
          onPress={onCancel}
          style={pill}
        />
      ) : null}
    </View>
  );
}
