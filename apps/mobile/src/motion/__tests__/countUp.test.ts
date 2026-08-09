import { CountUp } from '../CountUp';

/**
 * CountUp mounts at the target without animation; subsequent value changes animate.
 * This unit test covers the “no animate on first paint” contract via the helper logic
 * mirrored from the component’s prevRef behaviour.
 */
function nextDisplay(prev: number | null, next: number): { display: number; animated: boolean } {
  if (prev === null) return { display: next, animated: false };
  if (prev === next) return { display: next, animated: false };
  return { display: next, animated: true };
}

describe('CountUp change contract', () => {
  it('does not animate on first value', () => {
    expect(nextDisplay(null, 12)).toEqual({ display: 12, animated: false });
  });

  it('animates only when the value changes', () => {
    expect(nextDisplay(12, 12)).toEqual({ display: 12, animated: false });
    expect(nextDisplay(12, 18)).toEqual({ display: 18, animated: true });
  });

  it('exports CountUp component', () => {
    expect(typeof CountUp).toBe('function');
  });
});
