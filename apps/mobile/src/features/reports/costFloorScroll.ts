import { useSurfaceClearance } from '@/adaptive/useSurfaceClearance';
import { useTheme } from '@/theme';

/**
 * Bottom pad so the last board on a Cost & Performance page clears the
 * floating tab pill (pill height + home indicator + a quiet extra gap).
 */
export function useCostFloorScrollPad() {
  const surfaceClearance = useSurfaceClearance();
  const { theme } = useTheme();
  return theme.spacing['3xl'] + surfaceClearance;
}
