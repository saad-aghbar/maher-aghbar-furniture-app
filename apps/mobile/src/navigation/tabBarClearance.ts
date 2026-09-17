import type { AppSurface } from '@maher/permissions';
import type { MaherWindowClass } from '@/adaptive/layoutTypes';

/** Extra bottom inset so scroll/list content clears the floating surface tab bar. */
export const SURFACE_TAB_BAR_CLEARANCE = 88;

/**
 * Extra space reserved for the floating tab pill.
 * Admin rail/sidebar (MEDIUM+) drops it. Dealer and worker keep the pill at
 * every width, so they keep this reserve everywhere.
 */
export function tabBarReserve(
  windowClass: MaherWindowClass,
  surface: AppSurface = 'admin',
): number {
  if (surface !== 'admin') return SURFACE_TAB_BAR_CLEARANCE;
  return windowClass === 'compact' ? SURFACE_TAB_BAR_CLEARANCE : 0;
}

/**
 * Scroll/list bottom inset: tab reserve + safe area.
 */
export function surfaceClearanceFor(
  windowClass: MaherWindowClass,
  safeBottom: number,
  surface: AppSurface = 'admin',
): number {
  return tabBarReserve(windowClass, surface) + Math.max(0, safeBottom);
}

/**
 * Last-content inset so the last list row clears the floating pill
 * (`insets.bottom + SURFACE_TAB_BAR_CLEARANCE`). Prefer this as FlatList
 * `paddingBottom` and `ListFooterComponent` height — VirtualizedList always
 * counts the footer in content size.
 */
export function surfaceListBottomInset(
  safeBottom: number,
  windowClass: MaherWindowClass = 'compact',
  surface: AppSurface = 'admin',
): number {
  return surfaceClearanceFor(windowClass, safeBottom, surface);
}

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
  windowClass: MaherWindowClass = 'compact',
  surface: AppSurface = 'admin',
): number {
  return surfaceClearanceFor(windowClass, Math.max(safeBottom, minGap), surface);
}

/** Dealer FAB sits above the pill — extra clearance for home/catalog scroll. */
export const DEALER_TAB_BAR_CLEARANCE = 108;

/** Slim floating chat composer height (single-line). */
export const CHAT_COMPOSER_HEIGHT = 44;

/** Gap between floating composer and tab bar. */
export const CHAT_COMPOSER_TAB_GAP = 8;
