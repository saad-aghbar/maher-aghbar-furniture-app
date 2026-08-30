import type { ColorScheme, ThemeColors, ThemeElevation, ThemeRadius } from './types';

/**
 * Employee-only industrial production palettes (light + dark).
 * Distinct from admin/dealer parchment (`#E1DFD3`) / liquorice — cool workshop stone vs charcoal.
 */

/** Dark — charcoal floor tool. */
export const employeeIndustrialDarkColors: ThemeColors = {
  background: '#141210',
  surface: '#221E1C',
  surfaceSecondary: '#2C2724',
  surfaceElevated: '#2E2926',
  textPrimary: '#F7F4EF',
  textSecondary: '#C9C2B8',
  textMuted: '#8F877C',
  border: 'rgba(247, 244, 239, 0.10)',
  borderMuted: 'rgba(247, 244, 239, 0.06)',
  borderStrong: 'rgba(247, 244, 239, 0.18)',
  brand: '#C4A06A',
  brandHover: '#D4B37E',
  brandActive: '#A88952',
  brandSoft: 'rgba(196, 160, 106, 0.20)',
  onBrand: '#141210',
  success: '#9AAA7A',
  successSoft: 'rgba(154, 170, 122, 0.20)',
  warning: '#D4A86A',
  warningSoft: 'rgba(212, 168, 106, 0.20)',
  error: '#D08878',
  errorSoft: 'rgba(208, 136, 120, 0.20)',
  info: '#B5A48C',
  infoSoft: 'rgba(181, 164, 140, 0.18)',
  disabled: '#6E675E',
  disabledFill: '#2C2724',
  overlay: 'rgba(0, 0, 0, 0.62)',
  calendarLoadEmpty: '#2C2724',
  calendarLoadLight: 'rgba(196, 160, 106, 0.40)',
  calendarLoadHalf: 'rgba(212, 168, 106, 0.55)',
  calendarLoadBusy: 'rgba(208, 136, 120, 0.62)',
  calendarLoadClosed: 'rgba(247, 244, 239, 0.18)',
};

/** Light — cool workshop stone (not admin cream parchment). */
export const employeeIndustrialLightColors: ThemeColors = {
  background: '#D5D3CC',
  surface: '#F3F2EE',
  surfaceSecondary: '#E7E5DF',
  surfaceElevated: '#FAF9F6',
  textPrimary: '#1A1714',
  textSecondary: '#4A453E',
  textMuted: '#7A746A',
  border: 'rgba(26, 23, 20, 0.10)',
  borderMuted: 'rgba(26, 23, 20, 0.06)',
  borderStrong: 'rgba(26, 23, 20, 0.18)',
  brand: '#8B7049',
  brandHover: '#776245',
  brandActive: '#5C4A32',
  brandSoft: 'rgba(139, 112, 73, 0.16)',
  onBrand: '#F3F2EE',
  success: '#4F5A3C',
  successSoft: '#E4E7DC',
  warning: '#8B7049',
  warningSoft: '#F0E9DF',
  error: '#8A4A3C',
  errorSoft: '#F0E6E2',
  info: '#5E564C',
  infoSoft: '#E9E6E1',
  disabled: '#8A857C',
  disabledFill: '#E7E5DF',
  overlay: 'rgba(26, 23, 20, 0.42)',
  calendarLoadEmpty: '#FAF9F6',
  calendarLoadLight: '#DDD2BC',
  calendarLoadHalf: '#C9A86A',
  calendarLoadBusy: '#A86B58',
  calendarLoadClosed: '#9A948A',
};

/** @deprecated Use scheme-aware helpers — alias of dark for older imports. */
export const employeeIndustrialColors = employeeIndustrialDarkColors;

const none = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
} as const;

export const employeeIndustrialDarkElevation: ThemeElevation = {
  none,
  rest: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.36,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 22,
    elevation: 6,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.48,
    shadowRadius: 26,
    elevation: 8,
  },
};

export const employeeIndustrialLightElevation: ThemeElevation = {
  none,
  rest: {
    shadowColor: '#1A1714',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 2,
  },
  card: {
    shadowColor: '#1A1714',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  raised: {
    shadowColor: '#1A1714',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 6,
  },
};

/** @deprecated Prefer scheme-aware elevation. */
export const employeeIndustrialElevation = employeeIndustrialDarkElevation;

/** Slightly larger boards for gloved / one-handed floor use. */
export const employeeIndustrialRadius: ThemeRadius = {
  none: 0,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

export function employeeIndustrialColorsFor(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? employeeIndustrialDarkColors : employeeIndustrialLightColors;
}

export function employeeIndustrialElevationFor(scheme: ColorScheme): ThemeElevation {
  return scheme === 'dark' ? employeeIndustrialDarkElevation : employeeIndustrialLightElevation;
}

/** Detect worker industrial canvas (light or dark) for tab clearance, etc. */
export function isEmployeeIndustrialBackground(background: string): boolean {
  return (
    background === employeeIndustrialDarkColors.background ||
    background === employeeIndustrialLightColors.background
  );
}
