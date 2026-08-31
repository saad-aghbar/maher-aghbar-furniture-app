import {
  Easing,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
} from 'react-native-reanimated';
import { durations } from './presets';

const ease = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * Quiet card/page enters — short timing, tiny travel, no spring overshoot.
 * Prefer this over `.springify()` on worker/admin boards.
 */
export function softFadeDown(delayMs = 0) {
  return FadeInDown.delay(delayMs)
    .duration(durations.micro)
    .easing(ease)
    .withInitialValues({
      transform: [{ translateY: 4 }],
    });
}

export function softFadeSide(isRTL: boolean, delayMs = 0) {
  const Enter = isRTL ? FadeInLeft : FadeInRight;
  const fromX = isRTL ? -5 : 5;
  return Enter.delay(delayMs)
    .duration(durations.micro)
    .easing(ease)
    .withInitialValues({
      transform: [{ translateX: fromX }],
    });
}
