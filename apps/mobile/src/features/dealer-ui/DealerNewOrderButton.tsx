import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { dealerTokens, useTheme } from '@/theme';

export const DEALER_FAB_SIZE = 58;

import {
  DEALER_NEW_ORDER_A11Y_KEY,
  DEALER_NEW_ORDER_HREF,
} from './dealerFabConstants';

export { DEALER_NEW_ORDER_A11Y_KEY, DEALER_NEW_ORDER_HREF };

type Props = {
  /** When false, hide (e.g. no permission). Default: gate on request.create */
  visible?: boolean;
};

/**
 * Center sculpted + New Order FAB for the dealer floating tab bar.
 */
export function DealerNewOrderButton({ visible }: Props) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const tokens = dealerTokens(colors);
  const allowed = visible ?? can(user, 'request.create');

  if (!allowed) return null;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={t(DEALER_NEW_ORDER_A11Y_KEY)}
      onPress={() => {
        void haptics.confirmMedium();
        router.navigate(DEALER_NEW_ORDER_HREF as Href);
      }}
      style={{
        width: DEALER_FAB_SIZE,
        height: DEALER_FAB_SIZE,
        borderRadius: DEALER_FAB_SIZE / 2,
        backgroundColor: tokens.fab,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.surface,
        ...theme.elevation.raised,
      }}
    >
      <View pointerEvents="none">
        <Ionicons name="add" size={32} color={tokens.onFab} />
      </View>
    </AnimatedPressable>
  );
}
