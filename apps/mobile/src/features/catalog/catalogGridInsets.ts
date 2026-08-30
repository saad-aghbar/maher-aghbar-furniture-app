import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';

/**
 * Admin products grid last-content inset so the last row clears the floating tab
 * (and the chocolate + FAB when present). Padding only — no tab restyle.
 */
export function adminCatalogListBottomPad(
  insetsBottom: number,
  fabExtra = 0,
): number {
  return insetsBottom + SURFACE_TAB_BAR_CLEARANCE + fabExtra;
}

/** FAB `bottom` so the + sits above the floating tab, not on it. */
export function adminCatalogFabBottom(insetsBottom: number): number {
  return insetsBottom + SURFACE_TAB_BAR_CLEARANCE;
}
