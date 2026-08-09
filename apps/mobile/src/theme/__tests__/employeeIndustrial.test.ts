import {
  employeeIndustrialColorsFor,
  employeeIndustrialDarkColors,
  employeeIndustrialElevationFor,
  employeeIndustrialLightColors,
  isEmployeeIndustrialBackground,
} from '../employeeIndustrial';
import { lightColors, darkColors } from '../colors';

describe('employeeIndustrial theme', () => {
  it('returns distinct light and dark industrial palettes', () => {
    const light = employeeIndustrialColorsFor('light');
    const dark = employeeIndustrialColorsFor('dark');
    expect(light.background).toBe(employeeIndustrialLightColors.background);
    expect(dark.background).toBe(employeeIndustrialDarkColors.background);
    expect(light.background).not.toBe(dark.background);
    expect(light.textPrimary).not.toBe(dark.textPrimary);
  });

  it('stays distinct from admin/dealer parchment and liquorice', () => {
    expect(employeeIndustrialLightColors.background).not.toBe(lightColors.background);
    expect(employeeIndustrialLightColors.surface).not.toBe(lightColors.surface);
    expect(employeeIndustrialDarkColors.background).not.toBe(darkColors.background);
  });

  it('detects industrial backgrounds only', () => {
    expect(isEmployeeIndustrialBackground(employeeIndustrialLightColors.background)).toBe(true);
    expect(isEmployeeIndustrialBackground(employeeIndustrialDarkColors.background)).toBe(true);
    expect(isEmployeeIndustrialBackground(lightColors.background)).toBe(false);
    expect(isEmployeeIndustrialBackground(darkColors.background)).toBe(false);
  });

  it('provides scheme-aware elevation', () => {
    const lightEl = employeeIndustrialElevationFor('light');
    const darkEl = employeeIndustrialElevationFor('dark');
    expect(lightEl.card.shadowOpacity).toBeLessThan(darkEl.card.shadowOpacity);
    expect(darkEl.card.shadowColor).toBe('#000000');
  });

  it('keeps high-contrast brand ink on both schemes', () => {
    const light = employeeIndustrialColorsFor('light');
    const dark = employeeIndustrialColorsFor('dark');
    expect(light.brand).toBeTruthy();
    expect(dark.brand).toBeTruthy();
    expect(light.onBrand).not.toBe(light.brand);
    expect(dark.onBrand).not.toBe(dark.brand);
  });
});
