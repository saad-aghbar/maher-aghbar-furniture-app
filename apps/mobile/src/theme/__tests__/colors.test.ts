import { darkColors, lightColors } from '../colors';
import { brandColors } from '../brand';
import { radius } from '../radius';

describe('light canvas tokens', () => {
  it('uses oatmeal canvas and wood-bronze brand from the live home', () => {
    expect(lightColors.background).toBe('#F3F0E9');
    expect(lightColors.surfaceSecondary).toBe('#EBE7DD');
    expect(lightColors.brand).toBe(brandColors.primary);
    expect(lightColors.brandHover).toBe('#7B6651');
    expect(lightColors.attention).toBe('#2F2924');
    expect(lightColors.attentionAccent).toBe('#B79B7B');
  });

  it('keeps login ivory and splash beige as companion tokens', () => {
    expect(brandColors.background).toBe('#F5F1EA');
    expect(lightColors.onBrand).toBe('#F5F1EA');
    expect(darkColors.background).toBe('#1E1A1B');
  });

  it('exposes a card radius in the 16–24px board range', () => {
    expect(radius.card).toBeGreaterThanOrEqual(16);
    expect(radius.card).toBeLessThanOrEqual(24);
    expect(radius.xl).toBeGreaterThanOrEqual(16);
  });
});
