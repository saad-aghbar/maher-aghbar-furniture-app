import { useMemo } from 'react';
import type { AppSurface } from '@maher/permissions';
import { useAdaptiveSurface } from './AdaptiveSurfaceContext';
import {
  resolveColumnCapacity,
  resolveContentDensity,
  resolveNavigationMode,
  resolveWindowClass,
} from './breakpoints';
import type { MaherLayout } from './layoutTypes';
import { useWindowMetrics } from './windowMetrics';

/** Pure builder — exported for tests and for non-hook call sites. */
export function buildMaherLayout(width: number, height: number, surface: AppSurface): MaherLayout {
  const windowClass = resolveWindowClass(width);
  return {
    windowClass,
    width,
    height,
    isCompact: windowClass === 'compact',
    isMedium: windowClass === 'medium',
    isExpanded: windowClass === 'expanded',
    isWide: windowClass === 'wide',
    isLarge: windowClass !== 'compact',
    isDesk: windowClass === 'expanded' || windowClass === 'wide',
    navigationMode: resolveNavigationMode(windowClass, surface),
    contentDensity: resolveContentDensity(windowClass),
    columnCapacity: resolveColumnCapacity(windowClass),
    surface,
  };
}

/**
 * Canonical adaptive layout hook. Re-renders on window size changes only;
 * never remounts anything by itself.
 */
export function useMaherLayout(options?: { surface?: AppSurface }): MaherLayout {
  const metrics = useWindowMetrics();
  const contextSurface = useAdaptiveSurface();
  const surface = options?.surface ?? contextSurface;
  return useMemo(
    () => buildMaherLayout(metrics.width, metrics.height, surface),
    [metrics.width, metrics.height, surface],
  );
}
