import type { ColorScheme } from '@/theme/types';
import { brandColors } from '@/theme/brand';

export type LoginColors = {
  background: string;
  backgroundDeep: string;
  surfaceGlass: string;
  surfaceSolid: string;
  border: string;
  borderFocus: string;
  inputBackground: string;
  inputBorder: string;
  brandGold: string;
  brandGoldSoft: string;
  brandBeige: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  error: string;
  onBrand: string;
  chromeBg: string;
  chromeBorder: string;
  specular: string;
  radialGlow: string;
  blurIntensity: number;
  blurTint: 'light' | 'dark' | 'default';
};

const light: LoginColors = {
  background: brandColors.background,
  backgroundDeep: '#D8D2C4',
  surfaceGlass: 'rgba(245, 241, 234, 0.82)',
  surfaceSolid: 'rgba(245, 241, 234, 0.96)',
  border: 'rgba(55, 38, 18, 0.10)',
  borderFocus: brandColors.primary,
  inputBackground: 'rgba(245, 241, 234, 0.94)',
  inputBorder: 'rgba(55, 38, 18, 0.14)',
  brandGold: brandColors.primary,
  brandGoldSoft: brandColors.primarySoft,
  brandBeige: '#E1DFD3',
  textPrimary: brandColors.foreground,
  textSecondary: '#5C574F',
  textMuted: '#8A857C',
  error: '#7A4538',
  onBrand: '#F5F1EA',
  chromeBg: 'rgba(245, 241, 234, 0.72)',
  chromeBorder: 'rgba(55, 38, 18, 0.10)',
  specular: 'rgba(255, 248, 238, 0.55)',
  radialGlow: 'rgba(139, 112, 73, 0.16)',
  blurIntensity: 52,
  blurTint: 'light',
};

const dark: LoginColors = {
  background: brandColors.backgroundDark,
  backgroundDeep: '#0A0A0C',
  surfaceGlass: 'rgba(28, 28, 30, 0.72)',
  surfaceSolid: 'rgba(44, 44, 46, 0.88)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderFocus: '#C4A574',
  inputBackground: 'rgba(44, 44, 46, 0.75)',
  inputBorder: 'rgba(255, 255, 255, 0.14)',
  brandGold: '#C4A574',
  brandGoldSoft: 'rgba(196, 165, 116, 0.2)',
  brandBeige: '#E1DFD3',
  textPrimary: brandColors.foregroundOnDark,
  textSecondary: '#A1A1A6',
  textMuted: '#8E8E93',
  error: '#C4897A',
  onBrand: brandColors.foreground,
  chromeBg: 'rgba(28, 28, 30, 0.65)',
  chromeBorder: 'rgba(255, 255, 255, 0.1)',
  specular: 'rgba(255, 255, 255, 0.18)',
  radialGlow: 'rgba(196, 165, 116, 0.16)',
  blurIntensity: 56,
  blurTint: 'dark',
};

/** Adaptive warm login palette — brand mark color from `brandColors`. */
export function getLoginColors(scheme: ColorScheme): LoginColors {
  return scheme === 'dark' ? dark : light;
}

/** @deprecated Prefer getLoginColors(colorScheme) */
export const authColors = dark;
