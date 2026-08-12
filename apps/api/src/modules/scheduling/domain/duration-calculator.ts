import type { DurationEstimateInput } from './types';

/**
 * Deterministic stage duration from quantity scaling mode.
 * Returns whole minutes (ceil where fractional batches apply).
 */
export function calculateDurationMinutes(input: DurationEstimateInput): number {
  const qty = Math.max(0, Number(input.quantity) || 0);
  const setup = Math.max(0, input.setupMinutes ?? 0);
  const perUnit = Math.max(0, input.minutesPerUnit ?? 0);
  const fixed = Math.max(0, input.fixedMinutes ?? 0);

  switch (input.quantityScalingMode) {
    case 'LINEAR':
      return Math.ceil(perUnit * qty);
    case 'FIXED':
      return Math.ceil(fixed);
    case 'SETUP_PLUS_LINEAR':
      return Math.ceil(setup + perUnit * qty);
    case 'BATCH': {
      const batchSize = Math.max(1, input.batchSize ?? 1);
      const batchMinutes = Math.max(0, input.batchMinutes ?? 0);
      return Math.ceil(Math.ceil(qty / batchSize) * batchMinutes);
    }
    case 'PARALLEL_CAPACITY': {
      const maxParallel = Math.max(1, input.maxParallelUnits ?? 1);
      const waves = Math.ceil(qty / maxParallel);
      return Math.ceil(setup + waves * perUnit);
    }
    default: {
      const _exhaustive: never = input.quantityScalingMode;
      void _exhaustive;
      return 0;
    }
  }
}
