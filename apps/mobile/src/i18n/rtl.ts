import type { Direction, Locale } from '@maher/types';
import { getDirection } from '@maher/i18n';
import type { ViewStyle } from 'react-native';

export function isRtlLocale(locale: Locale): boolean {
  return getDirection(locale) === 'rtl';
}

export function textAlignFor(direction: Direction): 'left' | 'right' {
  return direction === 'rtl' ? 'right' : 'left';
}

export function flexDirectionFor(direction: Direction): 'row' | 'row-reverse' {
  return direction === 'rtl' ? 'row-reverse' : 'row';
}

/** Mirror directional icons (chevrons, back arrows) in RTL. */
export function mirrorStyle(isRTL: boolean): ViewStyle | undefined {
  if (!isRTL) return undefined;
  return { transform: [{ scaleX: -1 }] };
}
