import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useI18n } from '../providers/i18n-provider';
import { colors, MIN_TOUCH, radius, spacing, typography } from '../theme/tokens';
import { Text } from './Text';

export function Field({
  label,
  error,
  children,
}: {
  label?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      {label ? (
        <Text variant="caption" color="secondary">
          {label}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text variant="micro" color="error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function TextField({
  label,
  error,
  latin = false,
  style,
  ...rest
}: TextInputProps & { label?: string; error?: string; latin?: boolean }) {
  const { direction } = useI18n();
  return (
    <Field label={label} error={error}>
      <TextInput
        placeholderTextColor={colors.textTertiary}
        {...rest}
        style={[
          styles.input,
          { writingDirection: latin ? 'ltr' : direction },
          error ? styles.inputError : null,
          style,
        ]}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: MIN_TOUCH,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    ...typography.body,
  },
  inputError: { borderColor: colors.error },
});
