import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { surfaceListBottomInset } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';

/**
 * Bottom pad so the last board on a Cost & Performance page clears the
 * floating tab pill (pill height + home indicator + a quiet extra gap).
 */
export function useCostFloorScrollPad() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  return theme.spacing['3xl'] + surfaceListBottomInset(insets.bottom);
}
