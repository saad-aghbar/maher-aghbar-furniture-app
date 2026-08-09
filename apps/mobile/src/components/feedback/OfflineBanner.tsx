import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useTheme } from '@/theme';

type OfflineBannerProps = {
  message?: string;
};

export function OfflineBanner({ message = 'You are offline' }: OfflineBannerProps) {
  const { showOfflineBanner } = useNetwork();
  const { colors, theme } = useTheme();

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
        {message}
      </AppText>
    </View>
  );
}
