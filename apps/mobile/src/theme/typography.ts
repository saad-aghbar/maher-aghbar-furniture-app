import type { ThemeTypography } from './types';

/**
 * Readable hierarchy for older / non-technical users.
 * Exactly three weights — do not introduce 700+.
 */
export const typography: ThemeTypography = {
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
  },
  variants: {
    display: {
      fontSize: 34,
      lineHeight: 44,
      fontWeight: '600',
    },
    largeTitle: {
      fontSize: 28,
      lineHeight: 38,
      fontWeight: '600',
    },
    title: {
      fontSize: 22,
      lineHeight: 30,
      fontWeight: '600',
    },
    heading: {
      fontSize: 18,
      lineHeight: 26,
      fontWeight: '600',
    },
    body: {
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '400',
    },
    bodySecondary: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
    },
    label: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '500',
    },
  },
};
