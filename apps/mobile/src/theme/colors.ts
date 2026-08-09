import type { ThemeColors } from './types';

/**
 * Light — warm parchment / linen canvas (never pure white), Army Camo brand.
 * Semantic accents stay in the coffee / camo family (no traffic red / UI blue / mint).
 */
export const lightColors: ThemeColors = {
  background: '#E1DFD3',
  /** Warm paper — lifted from canvas, not Apple-white cards */
  surface: '#F5F1EA',
  surfaceSecondary: '#EBE6DC',
  textPrimary: '#1E1A1B',
  textSecondary: '#5C574F',
  textMuted: '#8A857C',
  border: '#D4CFC4',
  borderStrong: '#C4BDB0',
  brand: '#776245',
  brandHover: '#635239',
  brandActive: '#372612',
  brandSoft: '#EDE6DA',
  onBrand: '#F5F1EA',
  /** Delivered / complete — olive camo, not mint green */
  success: '#5A6348',
  successSoft: '#E9EBE3',
  /** Pending / needs attention — roasted amber coffee */
  warning: '#8B7049',
  warningSoft: '#F3EDE3',
  /** Failed / overdue — burnt sienna espresso (not traffic red) */
  error: '#7A4538',
  errorSoft: '#F2E8E4',
  /** In progress / info — warm stone taupe (not UI blue) */
  info: '#6E6254',
  infoSoft: '#EEEAE4',
  disabled: '#8A857C',
  disabledFill: '#EBE6DC',
  overlay: 'rgba(30, 26, 27, 0.40)',
};

/**
 * Dark — Liquorice base, lifted Army Camo.
 * Same coffee semantic family as light.
 */
export const darkColors: ThemeColors = {
  background: '#1E1A1B',
  surface: '#2A2425',
  surfaceSecondary: '#322C2D',
  textPrimary: '#E1DFD3',
  textSecondary: '#CACBCC',
  textMuted: '#8F8E8C',
  border: 'rgba(225, 223, 211, 0.12)',
  borderStrong: 'rgba(225, 223, 211, 0.20)',
  brand: '#A8906C',
  brandHover: '#BBA57E',
  brandActive: '#776245',
  brandSoft: 'rgba(168, 144, 108, 0.16)',
  onBrand: '#1E1A1B',
  success: '#9AAA7A',
  successSoft: 'rgba(154, 170, 122, 0.16)',
  warning: '#C4A06A',
  warningSoft: 'rgba(196, 160, 106, 0.16)',
  error: '#C4897A',
  errorSoft: 'rgba(196, 137, 122, 0.16)',
  info: '#B5A48C',
  infoSoft: 'rgba(181, 164, 140, 0.16)',
  disabled: '#8F8E8C',
  disabledFill: '#322C2D',
  overlay: 'rgba(0, 0, 0, 0.55)',
};
