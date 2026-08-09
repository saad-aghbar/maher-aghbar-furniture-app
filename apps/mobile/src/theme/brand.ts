/**
 * Official Maher Aghbar mark color — sampled from design-references/branding/maher-aghbar-logo.png.
 * Prefer these tokens over hardcoding hex in components.
 */
export const brandColors = {
  /** Primary mark / stroke beige-brown */
  primary: '#8B7049',
  /** Soft wash for chips, bubbles, glows */
  primarySoft: 'rgba(139, 112, 73, 0.16)',
  /** Warm ivory splash / login canvas (light) */
  background: '#F5F1EA',
  /** Dark canvas companion */
  backgroundDark: '#1A1614',
  /** Foreground on light brand surfaces */
  foreground: '#1E1A1B',
  /** Foreground on dark brand surfaces */
  foregroundOnDark: '#F5F1EA',
} as const;

export type BrandColors = typeof brandColors;

/** Nested semantic alias matching the brand intro spec. */
export const brand = {
  primary: brandColors.primary,
  primarySoft: brandColors.primarySoft,
  background: brandColors.background,
  foreground: brandColors.foreground,
} as const;
