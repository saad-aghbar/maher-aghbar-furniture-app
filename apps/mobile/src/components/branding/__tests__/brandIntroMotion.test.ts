import {
  brandIntroTimeline,
  brandIntroTotalMs,
  consumeBrandIntroMode,
  markBrandIntroCompleted,
  requestShortBrandIntro,
  resetBrandIntroSessionFlags,
} from '@/theme/brandIntroMotion';
import { brandColors } from '@/theme/brand';

describe('brandIntroMotion (Netflix sting)', () => {
  beforeEach(() => {
    resetBrandIntroSessionFlags();
  });

  it('plays full sting on first cold launch', () => {
    expect(consumeBrandIntroMode(false, { allowDevFull: false })).toBe('full');
  });

  it('uses reduced mode when OS reduce-motion is on', () => {
    expect(consumeBrandIntroMode(true, { allowDevFull: false })).toBe('reduced');
  });

  it('switches to short after completion', () => {
    markBrandIntroCompleted();
    expect(consumeBrandIntroMode(false, { allowDevFull: false })).toBe('short');
  });

  it('requestShortBrandIntro forces short', () => {
    requestShortBrandIntro();
    expect(consumeBrandIntroMode(false, { allowDevFull: false })).toBe('short');
  });

  it('keeps full sting under ~4s', () => {
    expect(brandIntroTotalMs('full')).toBeLessThanOrEqual(4200);
    expect(brandIntroTotalMs('full')).toBeGreaterThanOrEqual(2000);
    expect(brandIntroTimeline.slamMs).toBeGreaterThan(400);
    expect(brandIntroTimeline.dockMs).toBeGreaterThan(500);
  });
});

describe('brandColors', () => {
  it('exposes the official mark primary', () => {
    expect(brandColors.primary.toLowerCase()).toBe('#8b7049');
  });
});
