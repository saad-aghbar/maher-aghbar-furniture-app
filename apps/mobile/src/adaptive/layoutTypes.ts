import type { AppSurface } from '@maher/permissions';

/**
 * Width-driven window class. Available window width is authoritative —
 * never device name, `isPad`, or `Platform.OS`.
 *
 * compact  < 600   phones, iPad 1/3–1/2 split, narrow desktop windows
 * medium   600–899 iPad portrait, compact tablet windows
 * expanded 900–1199 iPad landscape, small laptops
 * wide     1200+   desktop / large monitor
 */
export type MaherWindowClass = 'compact' | 'medium' | 'expanded' | 'wide';

/** Chrome placement for the authenticated shell. Surface rules still apply (dealer/worker stay `bottom`). */
export type MaherNavigationMode = 'bottom' | 'rail' | 'sidebar';

/** Semantic density: factory floor tool → tablet workstation → factory desk → command desk. */
export type MaherContentDensity = 'floor' | 'workstation' | 'desk' | 'command';

export type MaherColumnCapacity = 1 | 2 | 3 | 4;

export type MaherLayout = {
  windowClass: MaherWindowClass;
  width: number;
  height: number;
  isCompact: boolean;
  isMedium: boolean;
  isExpanded: boolean;
  isWide: boolean;
  /** medium or larger — chrome may leave the phone bottom pill. */
  isLarge: boolean;
  /** expanded or larger — split panes and persistent sidebar territory. */
  isDesk: boolean;
  navigationMode: MaherNavigationMode;
  contentDensity: MaherContentDensity;
  columnCapacity: MaherColumnCapacity;
  surface: AppSurface;
};
