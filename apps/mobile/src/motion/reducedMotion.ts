/**
 * Pure helpers for reduced-motion behavior (unit-testable).
 */
export function resolveEnterOpacity(reduceMotion: boolean, animatedOpacity: number): number {
  return reduceMotion ? 1 : animatedOpacity;
}

export function resolveEnterTranslateY(reduceMotion: boolean, animatedY: number): number {
  return reduceMotion ? 0 : animatedY;
}

export function resolvePressScale(
  reduceMotion: boolean,
  pressedScale: number,
  restingScale = 1,
): number {
  return reduceMotion ? restingScale : pressedScale;
}

export function shimmerEnabled(reduceMotion: boolean): boolean {
  return !reduceMotion;
}
