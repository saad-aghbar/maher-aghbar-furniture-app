import type { SpringConfig } from '@/theme/types';

/** Named durations (ms) — keep within design-system ranges. */
export const durations = {
  press: 120,
  micro: 150,
  chip: 180,
  cardEnter: 220,
  screen: 280,
  sheet: 300,
  success: 550,
} as const;

export type DurationToken = keyof typeof durations;

/** Low-overshoot springs for UI chrome. */
export const springs = {
  press: { damping: 28, stiffness: 400, mass: 0.85 } satisfies SpringConfig,
  snappy: { damping: 26, stiffness: 280, mass: 0.9 } satisfies SpringConfig,
  gentle: { damping: 22, stiffness: 180, mass: 1 } satisfies SpringConfig,
  /** Soft success — high damping, little overshoot */
  success: { damping: 32, stiffness: 160, mass: 1 } satisfies SpringConfig,
} as const;

export type SpringToken = keyof typeof springs;

export const easingBezier = {
  standard: [0.4, 0, 0.2, 1] as const,
  emphasized: [0.16, 1, 0.3, 1] as const,
};

export const pressScale = {
  button: 0.97,
  card: 0.985,
} as const;

/**
 * When reduced motion is on, animations should complete instantly.
 */
export function withMotionDuration(durationMs: number, reduceMotion: boolean): number {
  return reduceMotion ? 0 : durationMs;
}

export function shouldAnimate(reduceMotion: boolean): boolean {
  return !reduceMotion;
}
