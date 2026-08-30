import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';

/** Bottom padding for sticky CTA docks above the surface tab bar. */
export function stickyCtaBottomInset(
  insetsBottom: number,
  spacingMd: number,
  tabClearance = SURFACE_TAB_BAR_CLEARANCE,
): number {
  return Math.max(insetsBottom, spacingMd) + tabClearance;
}
