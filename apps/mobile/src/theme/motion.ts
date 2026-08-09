import type { ThemeMotion } from './types';

/** Theme-level motion — prefer `@/motion/presets` for named UI durations. */
export const motion: ThemeMotion = {
  duration: {
    fast: 120,
    normal: 200,
    slow: 320,
  },
  easing: {
    standard: [0.4, 0, 0.2, 1],
    emphasized: [0.16, 1, 0.3, 1],
  },
  spring: {
    gentle: { damping: 22, stiffness: 180, mass: 1 },
    snappy: { damping: 26, stiffness: 280, mass: 0.9 },
    /** Controlled — not high bounce */
    bouncy: { damping: 20, stiffness: 220, mass: 1 },
  },
};
