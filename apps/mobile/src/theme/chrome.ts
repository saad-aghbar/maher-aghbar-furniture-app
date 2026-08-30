import type { ColorScheme, Theme, ThemeColors } from './types';

/**
 * Shared chrome sizes — circular EN / sun / bell, chocolate filter.
 * Match admin home (30 Aug 2026) rather than inventing a new scale.
 */
export const chromeSizes = {
  circle: 40,
  badge: 16,
  filter: 44,
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,
} as const;

export type AttentionChrome = {
  surface: string;
  accent: string;
  on: string;
  muted: string;
  border: string;
};

/** Dark charcoal + gold-tan ATTENTION language (image 4). */
export function attentionChrome(colors: ThemeColors): AttentionChrome {
  return {
    surface: colors.attention,
    accent: colors.attentionAccent,
    on: colors.attentionOn,
    muted: 'rgba(245, 241, 234, 0.65)',
    border: 'rgba(212, 196, 168, 0.22)',
  };
}

export type SheetChrome = {
  canvas: string;
  row: string;
  rowBorder: string;
  handle: string;
};

/** Cream sheet + bordered rows (image 3 — Show on Home). */
export function sheetChrome(colors: ThemeColors, scheme: ColorScheme): SheetChrome {
  return {
    canvas: colors.background,
    row: scheme === 'dark' ? colors.surfaceSecondary : colors.surface,
    rowBorder: colors.borderStrong,
    handle: colors.borderStrong,
  };
}

/** Pill search track — off-white on oatmeal, not a grey system field. */
export function searchTrackColor(colors: ThemeColors, scheme: ColorScheme): string {
  return scheme === 'dark' ? colors.surfaceSecondary : colors.surface;
}

/** Floating tab shell — cream pill, not a default RN tab bar. */
export function tabBarChrome(scheme: ColorScheme) {
  const dark = scheme === 'dark';
  return {
    shellBg: dark ? 'rgba(42, 36, 37, 0.72)' : 'rgba(255, 255, 255, 0.92)',
    shellBorder: dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(63, 52, 44, 0.12)',
    bubbleFill: dark ? 'rgba(255, 255, 255, 0.28)' : '#FFFFFF',
    bubbleBorder: dark ? 'rgba(255, 255, 255, 0.32)' : 'rgba(63, 52, 44, 0.10)',
  };
}

export function cardRadius(theme: Theme): number {
  return theme.radius.card;
}
