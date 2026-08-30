import { lightTheme } from '@/theme';
import {
  getButtonContainerStyle,
  getButtonLabelColor,
  getIconButtonStyle,
} from '../buttonStyles';

describe('buttonStyles', () => {
  it('enforces min touch height of 44', () => {
    for (const variant of ['primary', 'secondary', 'tertiary', 'destructive'] as const) {
      const style = getButtonContainerStyle(lightTheme, variant, false);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minHeight).toBe(lightTheme.sizes.touch.min);
    }
    const icon = getIconButtonStyle(lightTheme, false);
    expect(icon.minHeight).toBeGreaterThanOrEqual(44);
    expect(icon.width).toBe(lightTheme.sizes.touch.min);
  });

  it('uses pill radius for buttons', () => {
    const style = getButtonContainerStyle(lightTheme, 'primary', false);
    expect(style.borderRadius).toBe(lightTheme.radius.full);
    expect(getIconButtonStyle(lightTheme, false).borderRadius).toBe(lightTheme.radius.full);
  });

  it('maps variant colors from theme', () => {
    expect(getButtonContainerStyle(lightTheme, 'primary', false).backgroundColor).toBe(
      lightTheme.colors.brand,
    );
    expect(getButtonLabelColor(lightTheme, 'primary', false)).toBe(lightTheme.colors.onBrand);
    expect(getButtonLabelColor(lightTheme, 'secondary', false)).toBe(lightTheme.colors.brand);
    expect(getButtonContainerStyle(lightTheme, 'destructive', false).backgroundColor).toBe(
      lightTheme.colors.error,
    );
    expect(getButtonLabelColor(lightTheme, 'primary', true)).toBe(lightTheme.colors.disabled);
  });
});
