import type { FlexStyle, TextStyle, ViewStyle } from 'react-native';

/**
 * Freeze Yoga's I18nManager mirroring on this subtree so locale `isRTL`
 * (row-reverse / physical left-right) is the only flip — avoids a double
 * inversion after forceRTL.
 */
export const NOTIFICATION_LTR_TREE: ViewStyle = { direction: 'ltr' };

export function notificationLeadEdge(isRTL: boolean): { left: 0 } | { right: 0 } {
  return isRTL ? { right: 0 } : { left: 0 };
}

export function notificationRowDirection(
  isRTL: boolean,
): NonNullable<FlexStyle['flexDirection']> {
  return isRTL ? 'row-reverse' : 'row';
}

export function notificationStartAlign(
  isRTL: boolean,
): NonNullable<TextStyle['textAlign']> {
  return isRTL ? 'right' : 'left';
}

/** Extra padding on the start edge so the unread accent bar does not clip type. */
export function notificationStartBandPad(
  isRTL: boolean,
  extra: number,
): { paddingLeft: number } | { paddingRight: number } {
  return isRTL ? { paddingRight: extra } : { paddingLeft: extra };
}
