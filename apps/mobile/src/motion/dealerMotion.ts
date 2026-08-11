import { withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { springs, durations } from './presets';

/** Soft FAB press scale — use with AnimatedPressable or shared values. */
export const DEALER_FAB_PRESS_SCALE = 0.94;

/** New Order floating dock primary press scale. */
export const DEALER_WIZARD_DOCK_PRESS_SCALE = 0.96;

/** Stage-rail fill duration (ms); snap when reduce-motion. */
export function dealerStageRailDuration(reduceMotion: boolean): number {
  return reduceMotion ? 0 : durations.cardEnter;
}

/** Hero parallax amplitude in px (0 when reduce-motion). */
export function dealerHeroParallaxAmplitude(reduceMotion: boolean): number {
  return reduceMotion ? 0 : 8;
}

/** Apply settle spring to a shared value (FAB / carousel snap). */
export function dealerSettle(
  value: SharedValue<number>,
  to: number,
  reduceMotion: boolean,
): void {
  'worklet';
  if (reduceMotion) {
    value.value = to;
    return;
  }
  value.value = withSpring(to, springs.gentle);
}

/** Opacity fade for dealer section enters. */
export function dealerFadeTo(
  value: SharedValue<number>,
  to: number,
  reduceMotion: boolean,
): void {
  'worklet';
  if (reduceMotion) {
    value.value = to;
    return;
  }
  value.value = withTiming(to, { duration: durations.cardEnter });
}
