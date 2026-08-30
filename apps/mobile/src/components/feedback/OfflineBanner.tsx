import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { attentionChrome, useTheme } from '@/theme';

type OfflineBannerProps = {
  message?: string;
};

export function OfflineBanner({ message }: OfflineBannerProps) {
  const { t } = useLocale();
  const { showOfflineBanner } = useNetwork();
  const { colors, theme } = useTheme();
  const text = message ?? t('common.offline');
  const chrome = attentionChrome(colors);

  if (!showOfflineBanner) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{
        backgroundColor: chrome.surface,
        borderRadius: theme.radius.full,
        marginHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        minHeight: theme.sizes.touch.min,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: chrome.border,
      }}
    >
      <AppText variant="caption" weight="medium" style={{ color: chrome.accent }} align="center">
        {text}
      </AppText>
    </View>
  );
}
