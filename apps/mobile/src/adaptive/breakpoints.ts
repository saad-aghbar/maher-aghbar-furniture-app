import type { AppSurface } from '@maher/permissions';
import type {
  MaherColumnCapacity,
  MaherContentDensity,
  MaherNavigationMode,
  MaherWindowClass,
} from './layoutTypes';

/**
 * The ONLY place breakpoint numbers live. Feature code must resolve a
 * `MaherWindowClass` via `useMaherLayout` / `resolveWindowClass` rather than
 * comparing raw widths.
 */
export const MAHER_BREAKPOINTS = Object.freeze({
  /** First width (dp) that is MEDIUM. Anything below is COMPACT. */
  medium: 600,
  /** First width (dp) that is EXPANDED. */
  expanded: 900,
  /** First width (dp) that is WIDE. */
  wide: 1200,
});

export const WINDOW_CLASS_ORDER: readonly MaherWindowClass[] = [
  'compact',
  'medium',
  'expanded',
  'wide',
];

export function resolveWindowClass(width: number): MaherWindowClass {
  if (!Number.isFinite(width) || width < MAHER_BREAKPOINTS.medium) return 'compact';
  if (width < MAHER_BREAKPOINTS.expanded) return 'medium';
  if (width < MAHER_BREAKPOINTS.wide) return 'expanded';
  return 'wide';
}

/** True when `windowClass` is `min` or larger. */
export function isAtLeast(windowClass: MaherWindowClass, min: MaherWindowClass): boolean {
  return WINDOW_CLASS_ORDER.indexOf(windowClass) >= WINDOW_CLASS_ORDER.indexOf(min);
}

/**
 * Admin: bottom pill → rail → sidebar. Dealer and worker keep their bottom
 * chrome on every width in this phase (content adapts, chrome does not).
 */
export function resolveNavigationMode(
  windowClass: MaherWindowClass,
  surface: AppSurface,
): MaherNavigationMode {
  if (surface !== 'admin') return 'bottom';
  if (windowClass === 'compact') return 'bottom';
  if (windowClass === 'medium') return 'rail';
  return 'sidebar';
}

export function resolveColumnCapacity(windowClass: MaherWindowClass): MaherColumnCapacity {
  switch (windowClass) {
    case 'compact':
      return 1;
    case 'medium':
      return 2;
    case 'expanded':
      return 3;
    case 'wide':
      return 4;
  }
}

export function resolveContentDensity(windowClass: MaherWindowClass): MaherContentDensity {
  switch (windowClass) {
    case 'compact':
      return 'floor';
    case 'medium':
      return 'workstation';
    case 'expanded':
      return 'desk';
    case 'wide':
      return 'command';
  }
}
