import { useReducedMotion } from '@/motion/useReducedMotion';

/** Alias matching brand-intro spec naming; wraps OS reduce-motion preference. */
export function useReducedMotionPreference(): boolean {
  return useReducedMotion();
}
