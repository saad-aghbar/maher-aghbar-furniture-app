import type { ViewStyle } from 'react-native';
import { createElevation } from '@/theme/elevation';

/** Soft board elevation — production order hub + task floor parity. */
export function productionBoardShadow(colorScheme: 'light' | 'dark'): ViewStyle {
  return createElevation(colorScheme).card;
}

export function productionSectionLabelStyle(locale: string, brandColor: string) {
  return {
    color: brandColor,
    letterSpacing: locale === 'ar' ? 0 : 1.4,
    textTransform: (locale === 'ar' ? 'none' : 'uppercase') as 'none' | 'uppercase',
    fontSize: 11,
  };
}
