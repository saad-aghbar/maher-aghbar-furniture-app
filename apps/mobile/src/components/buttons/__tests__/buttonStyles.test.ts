import { I18nManager } from 'react-native';
import { lightTheme } from '@/theme';
import {
  getButtonContainerStyle,
  getButtonLabelColor,
  getIconButtonStyle,
} from '../buttonStyles';

function setNativeRtl(value: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', {
    configurable: true,
    get: () => value,
  });
}

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

  it('keeps leading icons on the reading-start side', () => {
    const original = Object.getOwnPropertyDescriptor(I18nManager, 'isRTL');
    setNativeRtl(false);
    expect(getButtonContainerStyle(lightTheme, 'primary', false, { isRTL: false }).flexDirection).toBe(
      'row',
    );
    expect(getButtonContainerStyle(lightTheme, 'primary', false, { isRTL: true }).flexDirection).toBe(
      'row-reverse',
    );
    setNativeRtl(true);
    expect(getButtonContainerStyle(lightTheme, 'primary', false, { isRTL: true }).flexDirection).toBe(
      'row',
    );
    if (original) Object.defineProperty(I18nManager, 'isRTL', original);
    else setNativeRtl(false);
  });
});
