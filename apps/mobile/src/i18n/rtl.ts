import type { Direction, Locale } from '@maher/types';
import { getDirection } from '@maher/i18n';
import { I18nManager, type ViewStyle } from 'react-native';

export function isRtlLocale(locale: Locale): boolean {
  return getDirection(locale) === 'rtl';
}

export function textAlignFor(direction: Direction): 'left' | 'right' {
  return direction === 'rtl' ? 'right' : 'left';
}

export function writingDirectionFor(isRTL: boolean): 'rtl' | 'ltr' {
  return isRTL ? 'rtl' : 'ltr';
}

/**
 * Start→end row for the active locale.
 * Native `row` already flips when I18nManager.isRTL matches; reverse only
 * when in-app locale and native RTL disagree (switch before reload).
 */
export function localeRow(isRTL: boolean): 'row' | 'row-reverse' {
  return I18nManager.isRTL === isRTL ? 'row' : 'row-reverse';
}

export function flexDirectionFor(direction: Direction): 'row' | 'row-reverse' {
  return localeRow(direction === 'rtl');
}

/** Pin an accent strip to the reading-start edge. */
export function pinStart(isRTL: boolean): ViewStyle {
  if (I18nManager.isRTL === isRTL) {
    return { start: 0 };
  }
  return isRTL ? { right: 0 } : { left: 0 };
}

/** Extra padding on the start edge (e.g. beside an accent strip). */
export function extraStartPadding(isRTL: boolean, extra: number): ViewStyle {
  if (I18nManager.isRTL === isRTL) {
    return { paddingStart: extra };
  }
  return isRTL ? { paddingRight: extra } : { paddingLeft: extra };
}

/** Pack children to the reading-start edge in a column. */
export function alignStart(isRTL: boolean): 'flex-start' | 'flex-end' {
  return isRTL ? 'flex-end' : 'flex-start';
}

/** Mirror directional icons (chevrons, back arrows) in RTL. */
export function mirrorStyle(isRTL: boolean): ViewStyle | undefined {
  if (!isRTL) return undefined;
  return { transform: [{ scaleX: -1 }] };
}
