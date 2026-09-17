import { type ReactElement } from 'react';
import { Dimensions } from 'react-native';
import { render } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';
import type { AppSurface } from '@maher/permissions';
import { AdaptiveSurfaceProvider } from '@/adaptive/AdaptiveSurfaceContext';
import { WindowMetricsOverride } from '@/adaptive/windowMetrics';
import { HARNESS_WINDOW } from './harnessScopes';
import { HarnessProviders, createHarnessQueryClient } from './testProviders';

/**
 * Canonical widths for adaptive screen tests. One per window class plus the
 * exact boundaries so composition tests read like the acceptance matrix.
 */
export const ADAPTIVE_WIDTHS = {
  compact: 390,
  mediumEdge: 600,
  medium: 820,
  expandedEdge: 900,
  expanded: 1024,
  ipadLandscape: 1194,
  wideEdge: 1200,
  ipad13Landscape: 1366,
  wide: 1440,
} as const;

function heightFor(width: number): number {
  // Phone-ish portrait below medium, tablet-ish landscape above.
  return width < 600 ? HARNESS_WINDOW.height : width < 900 ? 1180 : 1024;
}

/**
 * Point `Dimensions.get('window')` at the same width the adaptive layer sees,
 * so BottomSheet height caps and older layout code agree with `useMaherLayout`.
 * Returns a restore function.
 */
export function mockWindowDimensions(width: number, height = heightFor(width)): () => void {
  const spy = jest.spyOn(Dimensions, 'get').mockImplementation(() => ({
    width,
    height,
    scale: HARNESS_WINDOW.scale,
    fontScale: HARNESS_WINDOW.fontScale,
  }));
  return () => spy.mockRestore();
}

type RenderAdaptiveOptions = {
  width: number;
  height?: number;
  locale?: 'en' | 'ar' | 'he';
  surface?: AppSurface;
  queryClient?: QueryClient;
};

type RenderResult = Awaited<ReturnType<typeof render>>;

export type AdaptiveRenderResult = RenderResult & {
  /** Simulate a live window resize: same React tree, new metrics, no remount. */
  rerenderAt: (width: number, height?: number) => Promise<void>;
  /** Re-render new UI at the current width (props change without resize). */
  rerenderUi: (ui: ReactElement) => Promise<void>;
  restore: () => void;
};

/**
 * Render a screen at a given window width with the full provider stack
 * (theme, font scale, locale, query client, adaptive surface, metrics).
 */
export async function renderAdaptive(
  ui: ReactElement,
  opts: RenderAdaptiveOptions,
): Promise<AdaptiveRenderResult> {
  const queryClient = opts.queryClient ?? createHarnessQueryClient();
  let width = opts.width;
  let height = opts.height ?? heightFor(opts.width);
  let restore = mockWindowDimensions(width, height);
  let current = ui;
  const wrap = (element: ReactElement, w: number, h: number) => (
    <HarnessProviders locale={opts.locale} queryClient={queryClient}>
      <AdaptiveSurfaceProvider surface={opts.surface ?? 'admin'}>
        <WindowMetricsOverride value={{ width: w, height: h }}>{element}</WindowMetricsOverride>
      </AdaptiveSurfaceProvider>
    </HarnessProviders>
  );
  const view = await render(wrap(ui, width, height));
  return {
    ...view,
    async rerenderAt(nextWidth: number, nextHeight = heightFor(nextWidth)) {
      restore();
      width = nextWidth;
      height = nextHeight;
      restore = mockWindowDimensions(width, height);
      await view.rerender(wrap(current, width, height));
    },
    async rerenderUi(nextUi: ReactElement) {
      current = nextUi;
      await view.rerender(wrap(current, width, height));
    },
    restore: () => restore(),
  };
}
