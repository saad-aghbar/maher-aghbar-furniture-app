import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  surfaceClearanceFor,
  tabBarReserve,
} from '@/navigation/tabBarClearance';
import { useAdaptiveSurface } from './AdaptiveSurfaceContext';
import { useMaherLayout } from './useMaherLayout';

export { surfaceClearanceFor, tabBarReserve };

export function useTabBarReserve(): number {
  const { windowClass } = useMaherLayout();
  const surface = useAdaptiveSurface();
  return tabBarReserve(windowClass, surface);
}

export function useSurfaceClearance(): number {
  const { windowClass } = useMaherLayout();
  const surface = useAdaptiveSurface();
  const insets = useSafeAreaInsets();
  return surfaceClearanceFor(windowClass, insets.bottom, surface);
}
