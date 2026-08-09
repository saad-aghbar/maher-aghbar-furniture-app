import {
  resolveEnterOpacity,
  resolveEnterTranslateY,
  resolvePressScale,
  shimmerEnabled,
} from '../reducedMotion';

describe('reduced motion helpers', () => {
  it('forces final enter values when reduced', () => {
    expect(resolveEnterOpacity(true, 0.2)).toBe(1);
    expect(resolveEnterOpacity(false, 0.2)).toBe(0.2);
    expect(resolveEnterTranslateY(true, 8)).toBe(0);
    expect(resolveEnterTranslateY(false, 8)).toBe(8);
  });

  it('disables press scale when reduced', () => {
    expect(resolvePressScale(true, 0.97)).toBe(1);
    expect(resolvePressScale(false, 0.97)).toBe(0.97);
  });

  it('disables shimmer when reduced', () => {
    expect(shimmerEnabled(true)).toBe(false);
    expect(shimmerEnabled(false)).toBe(true);
  });
});
