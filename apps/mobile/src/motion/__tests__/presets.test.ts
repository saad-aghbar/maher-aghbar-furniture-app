import {
  durations,
  pressScale,
  shouldAnimate,
  springs,
  withMotionDuration,
} from '../presets';

describe('motion presets', () => {
  it('keeps durations in recommended ranges', () => {
    expect(durations.press).toBeGreaterThanOrEqual(100);
    expect(durations.press).toBeLessThanOrEqual(150);
    expect(durations.micro).toBeGreaterThanOrEqual(120);
    expect(durations.micro).toBeLessThanOrEqual(180);
    expect(durations.chip).toBeGreaterThanOrEqual(150);
    expect(durations.chip).toBeLessThanOrEqual(200);
    expect(durations.cardEnter).toBeGreaterThanOrEqual(180);
    expect(durations.cardEnter).toBeLessThanOrEqual(260);
    expect(durations.screen).toBeGreaterThanOrEqual(220);
    expect(durations.screen).toBeLessThanOrEqual(320);
    expect(durations.sheet).toBeGreaterThanOrEqual(250);
    expect(durations.sheet).toBeLessThanOrEqual(350);
    expect(durations.success).toBeGreaterThanOrEqual(400);
    expect(durations.success).toBeLessThanOrEqual(700);
  });

  it('uses controlled spring damping', () => {
    expect(springs.press.damping).toBeGreaterThanOrEqual(24);
    expect(springs.snappy.damping).toBeGreaterThanOrEqual(24);
    expect(springs.gentle.damping).toBeGreaterThanOrEqual(20);
  });

  it('defines restrained press scales', () => {
    expect(pressScale.button).toBeLessThan(1);
    expect(pressScale.button).toBeGreaterThan(0.95);
    expect(pressScale.card).toBeGreaterThan(pressScale.button);
  });

  it('withMotionDuration zeroes when reduced', () => {
    expect(withMotionDuration(220, true)).toBe(0);
    expect(withMotionDuration(220, false)).toBe(220);
    expect(shouldAnimate(true)).toBe(false);
    expect(shouldAnimate(false)).toBe(true);
  });
});
