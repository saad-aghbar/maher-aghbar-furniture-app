import { dealerTokens } from '../dealerTokens';
import { lightColors, darkColors } from '../colors';

describe('dealerTokens', () => {
  it('maps dealer aliases onto semantic theme colors (light)', () => {
    const t = dealerTokens(lightColors);
    expect(t.fab).toBe(lightColors.brand);
    expect(t.onFab).toBe(lightColors.onBrand);
    expect(t.heroWash).toBe(lightColors.brandSoft);
    expect(t.commerceSurface).toBe(lightColors.surface);
    expect(t.wizardDock).toBe(lightColors.surface);
  });

  it('maps dealer aliases onto semantic theme colors (dark)', () => {
    const t = dealerTokens(darkColors);
    expect(t.fab).toBe(darkColors.brand);
    expect(t.fabSoft).toBe(darkColors.brandSoft);
  });
});
