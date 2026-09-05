import type { ThemeColors } from '@/theme/types';
import type { FabricTone } from './selectFabricTracker';

export type FabricToneVisual = {
  rail: string;
  chipBg: string;
  chipInk: string;
  chipBorder: string;
};

/**
 * Floor palette for fabric lanes — olive settled, roasted amber waiting,
 * burnt sienna blocked, coffee brand for not-yet-started. No UI blue.
 */
export function resolveFabricTone(tone: FabricTone, colors: ThemeColors): FabricToneVisual {
  switch (tone) {
    case 'ready':
      return {
        rail: colors.success,
        chipBg: colors.successSoft,
        chipInk: colors.success,
        chipBorder: colors.success,
      };
    case 'waiting':
      return {
        rail: colors.warning,
        chipBg: colors.warningSoft,
        chipInk: colors.warning,
        chipBorder: colors.warning,
      };
    case 'blocked':
      return {
        rail: colors.error,
        chipBg: colors.errorSoft,
        chipInk: colors.error,
        chipBorder: colors.error,
      };
    default:
      return {
        rail: colors.brand,
        chipBg: colors.brandSoft,
        chipInk: colors.brand,
        chipBorder: colors.brand,
      };
  }
}
