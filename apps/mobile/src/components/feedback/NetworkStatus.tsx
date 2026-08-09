import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n/useLocale';
import { useTheme } from '@/theme';

const STATUS_COPY = {
  online: 'Online',
  offline: 'Offline',
  unknown: 'Connecting…',
} as const;

export function NetworkStatus() {
  const { status } = useNetwork();
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();

  const dot =
    status === 'online' ? colors.success : status === 'offline' ? colors.error : colors.warning;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={STATUS_COPY[status]}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        minHeight: theme.sizes.touch.min,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dot,
        }}
      />
      <AppText variant="caption" color="secondary">
        {STATUS_COPY[status]}
      </AppText>
    </View>
  );
}
