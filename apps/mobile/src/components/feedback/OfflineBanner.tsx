import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type OfflineBannerProps = {
  message?: string;
};

export function OfflineBanner({ message }: OfflineBannerProps) {
  const { t } = useLocale();
  const { showOfflineBanner } = useNetwork();
  const { colors, theme } = useTheme();
  const text = message ?? t('common.offline');

  if (!showOfflineBanner) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{
        backgroundColor: colors.warningSoft,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        minHeight: theme.sizes.touch.min,
        justifyContent: 'center',
      }}
    >
      <AppText variant="caption" style={{ color: colors.warning }} align="center">
        {text}
      </AppText>
    </View>
  );
}
