import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { attentionChrome, useTheme } from '@/theme';

type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
}: ErrorStateProps) {
  const { t } = useLocale();
  const { theme, colors } = useTheme();
  const resolvedRetry = retryLabel ?? t('common.retry');
  const chrome = attentionChrome(colors);

  return (
    <View
      accessibilityRole="alert"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing['2xl'],
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <View
        style={{
          width: '100%',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing['2xl'],
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.card,
          backgroundColor: chrome.surface,
          borderWidth: 1,
          borderColor: chrome.border,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(183, 155, 123, 0.18)',
          }}
        >
          <Ionicons name="alert-circle-outline" size={22} color={chrome.accent} />
        </View>
        <AppText variant="heading" align="center" style={{ color: chrome.on }}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="bodySecondary" align="center" style={{ color: chrome.muted }}>
            {description}
          </AppText>
        ) : null}
        {onRetry ? (
          <SecondaryButton
            label={resolvedRetry}
            onPress={onRetry}
            style={{
              marginTop: theme.spacing.sm,
              alignSelf: 'stretch',
              backgroundColor: chrome.surface,
              borderColor: chrome.accent,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
