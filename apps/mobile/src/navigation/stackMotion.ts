import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useLocale } from '@/i18n/useLocale';
import { useTheme } from '@/theme';

/** Leading-edge share of screen width that can start swipe-back. */
export const SWIPE_BACK_EDGE_RATIO = 0.2;

/**
 * Shared stack motion — light horizontal slide + interactive swipe-back.
 * No fade transitions.
 *
 * RTL: iOS swipe edge / full-screen pan follow LocaleDirContext (semantic RTL).
 * Keep iOS animation as `slide_from_right` (maps to default) so it is not
 * double-inverted with SlideFromLeft. Android uses `slide_from_left` for RTL.
 *
 * Swipe-back only starts in the leading ~20% of the screen (left in LTR,
 * right in RTL via native start/end mirroring) so a swipe from the far edge
 * does not dismiss by accident.
 */
export function stackMotionOptionsFor(
  isRTL: boolean,
  screenWidth = 390,
  backgroundColor?: string,
) {
  const edgeZone = Math.max(1, Math.round(screenWidth * SWIPE_BACK_EDGE_RATIO));
  return {
    headerShown: false,
    animation: (Platform.OS === 'android' && isRTL
      ? 'slide_from_left'
      : 'slide_from_right') as 'slide_from_left' | 'slide_from_right',
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    /** iOS: constrain full-screen swipe to leading edge (`end` is max X from start). */
    gestureResponseDistance: {
      end: edgeZone,
    },
    ...(backgroundColor
      ? { contentStyle: { backgroundColor } }
      : {}),
  };
}

/** @deprecated Prefer `useStackMotionOptions` so RTL swipe matches the back arrow. */
export const stackMotionOptions = stackMotionOptionsFor(false);

/** Stack options that track the in-app locale (not stale I18nManager). */
export function useStackMotionOptions() {
  const { isRTL } = useLocale();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  return useMemo(
    () => stackMotionOptionsFor(isRTL, width, colors.background),
    [isRTL, width, colors.background],
  );
}
