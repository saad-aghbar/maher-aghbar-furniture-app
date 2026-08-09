import type { ThemeColors } from './types';
import { darkColors, lightColors } from './colors';

/** Boost contrast for AccessibilityInfo high-text-contrast / prefers-contrast. */
export function applyHighContrast(colors: ThemeColors, scheme: 'light' | 'dark'): ThemeColors {
  if (scheme === 'light') {
    return {
      ...colors,
      textPrimary: '#000000',
      textSecondary: '#1E1A1B',
      textMuted: '#3D3A36',
      border: '#6B6760',
      borderStrong: '#1E1A1B',
      brand: '#4A3A28',
      brandHover: '#372612',
      brandActive: '#24180C',
      error: '#8B0000',
      success: '#0B4D3A',
    };
  }
  return {
    ...colors,
    textPrimary: '#FFFFFF',
    textSecondary: '#E1DFD3',
    textMuted: '#CACBCC',
    border: 'rgba(255, 255, 255, 0.45)',
    borderStrong: 'rgba(255, 255, 255, 0.70)',
    brand: '#D4C09A',
    error: '#FF8A80',
    success: '#69F0AE',
  };
}

export function baseColorsForScheme(scheme: 'light' | 'dark'): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
