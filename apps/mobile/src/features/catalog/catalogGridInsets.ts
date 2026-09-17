import {
  SURFACE_TAB_BAR_CLEARANCE,
  surfaceClearanceFor,
  tabBarReserve,
} from '@/navigation/tabBarClearance';
import type { MaherWindowClass } from '@/adaptive/layoutTypes';

/**
 * Admin products grid last-content inset so the last row clears the floating tab
 * (and the chocolate + FAB when present). Padding only — no tab restyle.
 */
export function adminCatalogListBottomPad(
  insetsBottom: number,
  fabExtra = 0,
  windowClass: MaherWindowClass = 'compact',
): number {
  return surfaceClearanceFor(windowClass, insetsBottom) + fabExtra;
}

/** FAB `bottom` so the + sits above the floating tab, not on it. */
export function adminCatalogFabBottom(
  insetsBottom: number,
  windowClass: MaherWindowClass = 'compact',
): number {
  return tabBarReserve(windowClass) + Math.max(0, insetsBottom);
}

export { SURFACE_TAB_BAR_CLEARANCE };
