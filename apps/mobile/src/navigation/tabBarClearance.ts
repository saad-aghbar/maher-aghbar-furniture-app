/** Extra bottom inset so scroll/list content clears the floating surface tab bar. */
export const SURFACE_TAB_BAR_CLEARANCE = 88;

/**
 * Outer height of PersistentSurfaceTabBar floating shell
 * (SHELL_PAD 6 + ACTIVE_HEIGHT 46 + SHELL_PAD 6).
 */
export const SURFACE_TAB_BAR_HEIGHT = 58;

/**
 * Distance from the screen bottom to sit a dock or scroll pad above the
 * floating pill. The pill itself is already offset by the home-indicator
 * inset (`max(safeBottom, minGap)`), so that offset must be included here
 * or Hold/Cancel and last cards tuck under the bar.
 */
export function surfaceTabBarStackInset(
  safeBottom: number,
  minGap: number = 8,
): number {
  return SURFACE_TAB_BAR_CLEARANCE + Math.max(safeBottom, minGap);
}

/** Dealer FAB sits above the pill — extra clearance for home/catalog scroll. */
export const DEALER_TAB_BAR_CLEARANCE = 108;

/** Slim floating chat composer height (single-line). */
export const CHAT_COMPOSER_HEIGHT = 44;

/** Gap between floating composer and tab bar. */
export const CHAT_COMPOSER_TAB_GAP = 8;
