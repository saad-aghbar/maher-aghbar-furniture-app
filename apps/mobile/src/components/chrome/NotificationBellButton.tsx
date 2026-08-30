import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChromeBadge, ChromeCircleButton } from '@/components/chrome/ChromeCircleButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  unread: number;
  accessibilityLabel: string;
  onPress: () => void;
};

export function NotificationBellButton({ unread, accessibilityLabel, onPress }: Props) {
  const { colors } = useTheme();
  const { isRTL } = useLocale();

  return (
    <View>
      <ChromeCircleButton accessibilityLabel={accessibilityLabel} onPress={onPress}>
        <Ionicons name="notifications-outline" size={20} color={colors.brand} />
      </ChromeCircleButton>
      <ChromeBadge count={unread} isRTL={isRTL} />
    </View>
  );
}
