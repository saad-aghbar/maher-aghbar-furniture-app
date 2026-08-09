import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useTheme } from '@/theme';

type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title,
  description,
  retryLabel = 'Try again',
  onRetry,
}: ErrorStateProps) {
  const { theme, colors } = useTheme();

  return (
    <View
      accessibilityRole="alert"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing['3xl'],
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      <AppText variant="heading" align="center" style={{ color: colors.error }}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="bodySecondary" color="secondary" align="center">
          {description}
        </AppText>
      ) : null}
      {onRetry ? (
        <SecondaryButton
          label={retryLabel}
          onPress={onRetry}
          style={{ marginTop: theme.spacing.sm }}
        />
      ) : null}
    </View>
  );
}
