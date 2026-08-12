import type { ThemeColors } from '@/theme/types';
import type { DayTone } from './calendarMath';

export type AdminLoadLegendKey = 'empty' | 'light' | 'half' | 'busy' | 'closed';

export type LoadToneVisual = {
  bg: string;
  border: string;
  ink: string;
  dot: string;
  /** Legend swatch fill */
  swatch: string;
};

/** Shared load visuals — admin board + dealer availability calendar + legend. */
export function resolveAdminLoadVisual(
  tone: DayTone | AdminLoadLegendKey | undefined,
  colors: ThemeColors,
): LoadToneVisual {
  switch (tone) {
    case 'light':
      return {
        bg: colors.calendarLoadLight,
        border: colors.brand,
        ink: colors.textPrimary,
        dot: colors.brand,
        swatch: colors.calendarLoadLight,
      };
    case 'half':
      return {
        bg: colors.calendarLoadHalf,
        border: colors.warning,
        ink: colors.textPrimary,
        dot: colors.warning,
        swatch: colors.calendarLoadHalf,
      };
    case 'busy':
      return {
        bg: colors.calendarLoadBusy,
        border: colors.error,
        ink: colors.onBrand,
        dot: colors.onBrand,
        swatch: colors.calendarLoadBusy,
      };
    case 'closed':
    case 'unavailable':
      return {
        bg: colors.calendarLoadClosed,
        border: colors.borderStrong,
        ink: colors.onBrand,
        dot: colors.onBrand,
        swatch: colors.calendarLoadClosed,
      };
    case 'empty':
    default:
      return {
        bg: colors.calendarLoadEmpty,
        border: colors.borderStrong,
        ink: colors.textPrimary,
        dot: colors.brand,
        swatch: colors.calendarLoadEmpty,
      };
  }
}

export const ADMIN_LOAD_LEGEND: AdminLoadLegendKey[] = [
  'empty',
  'light',
  'half',
  'busy',
  'closed',
];
