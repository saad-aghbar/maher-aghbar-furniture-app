import { durations, springs, withMotionDuration } from '@/motion/presets';

/** Glossy Apple intro — multi-stroke write (~1.5–2.4s). */
export const loginMotion = {
  canvasFade: 360,
  strokeStagger: 110,
  strokeDraw: 480,
  strokeCount: 4,
  markReveal: 360,
  lockupCrossfade: 320,
  sheenSweep: 1600,
  copyFade: 260,
  chromeFade: 280,
  formRise: 340,
  fieldStagger: 70,
  buttonDelayAfterFields: 90,
  successHold: 620,
  idleBreathDuration: 5200,
  idleBreathScale: 1.018,
  idleTiltDeg: 1.4,
} as const;

export const loginSprings = {
  form: { ...springs.gentle, damping: 26, stiffness: 150 },
  press: springs.press,
  success: springs.success,
} as const;

export function loginDuration(ms: number, reduceMotion: boolean): number {
  return withMotionDuration(ms, reduceMotion);
}

export function strokesCompleteAtMs(): number {
  return (
    loginMotion.canvasFade * 0.4 +
    loginMotion.strokeDraw +
    loginMotion.strokeStagger * (loginMotion.strokeCount - 1)
  );
}

/** When form becomes interactive (do not gate inputs on full intro). */
export function formInteractiveAtMs(reduceMotion: boolean): number {
  if (reduceMotion) return 0;
  return strokesCompleteAtMs() * 0.55;
}

export function totalIntroMs(reduceMotion: boolean): number {
  if (reduceMotion) return durations.screen;
  return (
    strokesCompleteAtMs() +
    loginMotion.markReveal +
    loginMotion.lockupCrossfade +
    loginMotion.copyFade +
    loginMotion.formRise
  );
}

export type LoginPhase =
  | 'idle'
  | 'strokes'
  | 'mark'
  | 'lockup'
  | 'copy'
  | 'form'
  | 'ready'
  | 'success';
