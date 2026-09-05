import { I18nManager } from 'react-native';

/**
 * This app implements RTL in JS (row-reverse, textAlign, startEdge).
 * Native `forceRTL` is effectively a no-op in Expo Go, but a real iOS
 * development/device binary mirrors Yoga + translateX. That double-flip
 * misplaces every touch-bar bubble and a lot of floor chrome.
 *
 * Keep the native tree LTR. In-app locale still drives RTL.
 *
 * @returns true if native RTL was on and we turned it off (caller may reload).
 */
export function lockNativeLayoutLtr(): boolean {
  I18nManager.allowRTL(false);
  if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
    I18nManager.swapLeftAndRightInRTL(false);
  }
  if (!I18nManager.isRTL) return false;
  I18nManager.forceRTL(false);
  return true;
}
