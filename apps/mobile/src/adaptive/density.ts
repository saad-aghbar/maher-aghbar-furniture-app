import { useMemo } from 'react';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import type { MaherWindowClass } from './layoutTypes';
import { useMaherLayout } from './useMaherLayout';

/**
 * Adaptive density derived from existing Maher theme tokens. The `Theme` type
 * itself stays window-agnostic; this is a projection of it per window class.
 * COMPACT reproduces today's phone spacing exactly.
 */
export type MaherDensity = {
  /** Horizontal page padding for screens that opt into density padding. */
  pagePaddingH: number;
  /** Gap between major sections / boards stacks. */
  sectionGap: number;
  /** Gap between sibling boards / cards. */
  boardGap: number;
  /** Dense data row minimum height (DataRow). */
  rowMinHeight: number;
  /** Board corner radius — phone keeps `xl`, desks tighten. */
  boardRadius: number;
  /** Max width for single-column content; `undefined` means full bleed (compact). */
  contentMaxWidth: number | undefined;
  /** Gap between split panes. */
  paneGap: number;
  /** Admin navigation rail width (medium). */
  railWidth: number;
  /** Admin sidebar width (expanded / wide). */
  sidebarWidth: number;
  /** AdaptiveOverlay side-panel width (editor / inspector). */
  panelWidth: number;
  /** AdaptiveOverlay centered dialog max width. */
  dialogMaxWidth: number;
};

/** Horizontal carousel tile width — compact keeps the designed size. */
export function carouselCardWidth(
  windowClass: MaherWindowClass,
  compactWidth: number,
): number {
  switch (windowClass) {
    case 'compact':
      return compactWidth;
    case 'medium':
      return compactWidth + 24;
    case 'expanded':
      return compactWidth + 40;
    case 'wide':
      return compactWidth + 56;
  }
}

export function densityFor(windowClass: MaherWindowClass, theme: Theme): MaherDensity {
  const { spacing, radius } = theme;
  switch (windowClass) {
    case 'compact':
      return {
        pagePaddingH: spacing.lg,
        sectionGap: spacing.lg,
        boardGap: spacing.md,
        rowMinHeight: 56,
        boardRadius: radius.xl,
        contentMaxWidth: undefined,
        paneGap: 0,
        railWidth: 0,
        sidebarWidth: 0,
        panelWidth: 0,
        dialogMaxWidth: 0,
      };
    case 'medium':
      return {
        pagePaddingH: spacing.xl,
        sectionGap: spacing.md,
        boardGap: spacing.md,
        rowMinHeight: 52,
        boardRadius: radius.xl,
        contentMaxWidth: 920,
        paneGap: spacing.lg,
        railWidth: 76,
        sidebarWidth: 0,
        panelWidth: 400,
        dialogMaxWidth: 520,
      };
    case 'expanded':
      return {
        pagePaddingH: spacing['2xl'],
        sectionGap: spacing.md,
        boardGap: spacing.md,
        rowMinHeight: 48,
        boardRadius: radius.lg,
        contentMaxWidth: 1240,
        paneGap: spacing.lg,
        railWidth: 76,
        sidebarWidth: 240,
        panelWidth: 440,
        dialogMaxWidth: 560,
      };
    case 'wide':
      return {
        pagePaddingH: spacing['3xl'],
        sectionGap: spacing.md,
        boardGap: spacing.md,
        rowMinHeight: 44,
        boardRadius: radius.lg,
        contentMaxWidth: 1440,
        paneGap: spacing.xl,
        railWidth: 76,
        sidebarWidth: 256,
        panelWidth: 480,
        dialogMaxWidth: 600,
      };
  }
}

/** Density for the current window class and theme. */
export function useMaherDensity(): MaherDensity {
  const { windowClass } = useMaherLayout();
  const { theme } = useTheme();
  return useMemo(() => densityFor(windowClass, theme), [windowClass, theme]);
}
