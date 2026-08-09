import {
  CURVE_LENGTH,
  LOGO_VIEWBOX,
  PATH_CURVE,
  PATH_STEM,
  STEM_LENGTH,
} from '../MaherAghbarLogo';

describe('MaherAghbarLogo paths', () => {
  it('exposes scalable viewBox proportions', () => {
    expect(LOGO_VIEWBOX.w / LOGO_VIEWBOX.h).toBeGreaterThan(1.2);
    expect(LOGO_VIEWBOX.w / LOGO_VIEWBOX.h).toBeLessThan(1.7);
  });

  it('defines stroke paths for progressive drawing', () => {
    expect(PATH_STEM.startsWith('M')).toBe(true);
    expect(PATH_CURVE.startsWith('M')).toBe(true);
    expect(STEM_LENGTH).toBeGreaterThan(40);
    expect(CURVE_LENGTH).toBeGreaterThan(STEM_LENGTH);
  });
});
