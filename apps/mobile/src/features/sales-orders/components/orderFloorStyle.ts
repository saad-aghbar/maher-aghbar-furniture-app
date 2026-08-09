import type { ViewStyle } from 'react-native';
import { createElevation } from '@/theme/elevation';

/** Soft board elevation — shared card token (production + orders floor). */
export function orderBoardShadow(colorScheme: 'light' | 'dark'): ViewStyle {
  return createElevation(colorScheme).card;
}
