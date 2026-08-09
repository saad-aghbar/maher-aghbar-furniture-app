import {
  formInteractiveAtMs,
  loginDuration,
  strokesCompleteAtMs,
  totalIntroMs,
} from '@/features/auth/motion/loginMotion';

describe('loginMotion timing', () => {
  it('collapses durations under reduced motion', () => {
    expect(loginDuration(500, true)).toBe(0);
    expect(formInteractiveAtMs(true)).toBe(0);
    expect(totalIntroMs(true)).toBeLessThan(totalIntroMs(false));
  });

  it('keeps full intro in the polished window', () => {
    const total = totalIntroMs(false);
    expect(total).toBeGreaterThanOrEqual(1500);
    expect(total).toBeLessThanOrEqual(2400);
  });

  it('allows form interaction before intro completes', () => {
    expect(formInteractiveAtMs(false)).toBeLessThan(totalIntroMs(false));
    expect(formInteractiveAtMs(false)).toBeLessThan(strokesCompleteAtMs());
  });
});
