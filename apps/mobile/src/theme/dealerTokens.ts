import type { ThemeColors } from './types';

/**
 * Dealer commerce surface aliases — always derived from semantic theme colors.
 * Prefer these in dealer-ui / dealer-home instead of raw hex.
 */
export type DealerTokens = {
  /** Soft wash behind 2.5D hero */
  heroWash: string;
  /** Center New Order FAB fill */
  fab: string;
  /** Ink on FAB */
  onFab: string;
  /** Soft FAB glow / press wash */
  fabSoft: string;
  /** Premium card paper */
  commerceSurface: string;
  /** New Order floating dock shell fill alias */
  wizardDock: string;
};

export function dealerTokens(colors: ThemeColors): DealerTokens {
  return {
    heroWash: colors.brandSoft,
    fab: colors.brand,
    onFab: colors.onBrand,
    fabSoft: colors.brandSoft,
    commerceSurface: colors.surface,
    wizardDock: colors.surface,
  };
}
