import type { ThemeColors } from './types';

/**
 * Light — oatmeal canvas, off-white cards, wood-bronze brand.
 * Semantic accents stay in the coffee / camo family (no traffic red / UI blue / mint).
 * Splash stays `#E1DFD3`; login ivory stays `#F5F1EA` (see brand.ts / app.config).
 */
export const lightColors: ThemeColors = {
  background: '#F3F0E9',
  /** Off-white paper — lifted from canvas, not Apple-white cards */
  surface: '#F8F6F0',
  surfaceSecondary: '#EBE7DD',
  textPrimary: '#1E1A1B',
  textSecondary: '#5C574F',
  textMuted: '#8A857C',
  border: '#D4CFC4',
  borderStrong: '#C4BDB0',
  brand: '#8B7049',
  brandHover: '#7B6651',
  brandActive: '#5C4E3A',
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
  attention: '#2F2924',
  attentionAccent: '#B79B7B',
  attentionOn: '#F5F1EA',
  /** Schedule load — bright empty → sand → amber → sienna → stone (readable on parchment) */
  calendarLoadEmpty: '#FFFCF7',
  calendarLoadLight: '#E0D2B8',
  calendarLoadHalf: '#C9A86A',
  calendarLoadBusy: '#A86B58',
  calendarLoadClosed: '#9C968C',
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
  attention: '#1A1614',
  attentionAccent: '#C4A574',
  attentionOn: '#F5F1EA',
  calendarLoadEmpty: '#352F30',
  calendarLoadLight: 'rgba(168, 144, 108, 0.40)',
  calendarLoadHalf: 'rgba(196, 160, 106, 0.55)',
  calendarLoadBusy: 'rgba(196, 137, 122, 0.62)',
  calendarLoadClosed: 'rgba(225, 223, 211, 0.22)',
};
