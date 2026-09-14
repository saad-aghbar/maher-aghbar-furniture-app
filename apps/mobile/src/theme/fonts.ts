import {
  Platform,
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import type { FontWeightToken, TypographyVariantName } from './types';

/**
 * Latin UI face — IBM Plex Sans (OFL). Carries full ASCII, shekel, percent.
 */
export const PLEX_LATIN = {
  regular: 'IBMPlexSans-Regular',
  medium: 'IBMPlexSans-Medium',
  semibold: 'IBMPlexSans-SemiBold',
} as const;

/**
 * Arabic UI face — IBM Plex Sans Arabic (OFL). Also carries Latin + shekel,
 * so mixed SKU / price / Arabic labels stay on one family.
 */
export const PLEX_ARABIC = {
  regular: 'IBMPlexSansArabic-Regular',
  medium: 'IBMPlexSansArabic-Medium',
  semibold: 'IBMPlexSansArabic-SemiBold',
} as const;

/**
 * Hebrew UI face — IBM Plex Sans Hebrew (OFL). Also carries Latin + shekel.
 */
export const PLEX_HEBREW = {
  regular: 'IBMPlexSansHebrew-Regular',
  medium: 'IBMPlexSansHebrew-Medium',
  semibold: 'IBMPlexSansHebrew-SemiBold',
} as const;

/**
 * Plex Arabic is a UI face (unlike KO Sans). Only bump extremely tight
 * hero line boxes; do not inflate every Arabic label.
 */
const AR_MIN_LINE_RATIO = 1.2;

export type PlexLatinFamily = (typeof PLEX_LATIN)[keyof typeof PLEX_LATIN];
export type PlexArabicFamily = (typeof PLEX_ARABIC)[keyof typeof PLEX_ARABIC];
export type PlexHebrewFamily = (typeof PLEX_HEBREW)[keyof typeof PLEX_HEBREW];
export type AppFontFamily = PlexLatinFamily | PlexArabicFamily | PlexHebrewFamily;

/** expo-font map — keys become `fontFamily` values. */
export const plexLatinFontSources: Record<PlexLatinFamily, number> = {
  [PLEX_LATIN.regular]: require('../../assets/fonts/IBMPlexSans-Regular.ttf'),
  [PLEX_LATIN.medium]: require('../../assets/fonts/IBMPlexSans-Medium.ttf'),
  [PLEX_LATIN.semibold]: require('../../assets/fonts/IBMPlexSans-SemiBold.ttf'),
};

export const plexArabicFontSources: Record<PlexArabicFamily, number> = {
  [PLEX_ARABIC.regular]: require('../../assets/fonts/IBMPlexSansArabic-Regular.ttf'),
  [PLEX_ARABIC.medium]: require('../../assets/fonts/IBMPlexSansArabic-Medium.ttf'),
  [PLEX_ARABIC.semibold]: require('../../assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
};

export const plexHebrewFontSources: Record<PlexHebrewFamily, number> = {
  [PLEX_HEBREW.regular]: require('../../assets/fonts/IBMPlexSansHebrew-Regular.ttf'),
  [PLEX_HEBREW.medium]: require('../../assets/fonts/IBMPlexSansHebrew-Medium.ttf'),
  [PLEX_HEBREW.semibold]: require('../../assets/fonts/IBMPlexSansHebrew-SemiBold.ttf'),
};

export const plexFontSources = {
  ...plexLatinFontSources,
  ...plexArabicFontSources,
  ...plexHebrewFontSources,
};

const latinWeightToFamily: Record<FontWeightToken, PlexLatinFamily> = {
  regular: PLEX_LATIN.regular,
  medium: PLEX_LATIN.medium,
  semibold: PLEX_LATIN.semibold,
};

const arabicWeightToFamily: Record<FontWeightToken, PlexArabicFamily> = {
  regular: PLEX_ARABIC.regular,
  medium: PLEX_ARABIC.medium,
  semibold: PLEX_ARABIC.semibold,
};

const hebrewWeightToFamily: Record<FontWeightToken, PlexHebrewFamily> = {
  regular: PLEX_HEBREW.regular,
  medium: PLEX_HEBREW.medium,
  semibold: PLEX_HEBREW.semibold,
};

function weightFromVariant(variant?: TypographyVariantName): FontWeightToken {
  switch (variant) {
    case 'display':
    case 'largeTitle':
    case 'title':
    case 'heading':
      return 'medium';
    case 'caption':
    case 'label':
      return 'regular';
    default:
      return 'regular';
  }
}

/**
 * Resolve the app typeface for the active locale.
 * Arabic → Plex Arabic. Hebrew → Plex Hebrew. English → Plex Sans.
 * Weights map 1:1. Each family carries Latin, so mixed SKUs never tofu.
 */
export function resolveAppFontFamily(
  locale: string,
  opts: { weight?: FontWeightToken; variant?: TypographyVariantName } = {},
): AppFontFamily {
  const { weight, variant } = opts;
  const token = weight ?? weightFromVariant(variant);
  if (locale === 'ar') return arabicWeightToFamily[token];
  if (locale === 'he') return hebrewWeightToFamily[token];
  return latinWeightToFamily[token];
}

/**
 * Text / TextInput style fragment for the active locale.
 * Custom fonts must not combine `fontFamily` + `fontWeight` on Android.
 * Arabic never gets Latin tracking — letterSpacing breaks connected script.
 */
export function resolveAppFontStyle(
  locale: string,
  opts: {
    weight?: FontWeightToken;
    variant?: TypographyVariantName;
    /** Unused when a custom family is set; kept so existing call sites compile. */
    systemWeight?: NonNullable<TextStyle['fontWeight']>;
  } = {},
): TextStyle {
  const family = resolveAppFontFamily(locale, opts);
  if (locale === 'ar') {
    return { fontFamily: family, letterSpacing: 0 };
  }
  return { fontFamily: family };
}

const MONO_FAMILIES = new Set(['Courier', 'Courier New', 'monospace', 'Menlo']);

function isMonoFamily(family: string | undefined): boolean {
  return Boolean(family && MONO_FAMILIES.has(family));
}

export function weightTokenFromFontWeight(
  fontWeight: TextStyle['fontWeight'] | undefined,
): FontWeightToken | undefined {
  if (fontWeight == null) return undefined;
  const w = String(fontWeight);
  if (w === '100' || w === '200' || w === '300' || w === '400' || w === 'normal') {
    return 'regular';
  }
  if (w === '500') return 'medium';
  return 'semibold';
}

function weightTokenFromFamily(family: string | undefined): FontWeightToken | undefined {
  if (!family) return undefined;
  if (
    family === PLEX_LATIN.semibold ||
    family === PLEX_ARABIC.semibold ||
    family === PLEX_HEBREW.semibold
  ) {
    return 'semibold';
  }
  if (
    family === PLEX_LATIN.medium ||
    family === PLEX_ARABIC.medium ||
    family === PLEX_HEBREW.medium
  ) {
    return 'medium';
  }
  if (
    family === PLEX_LATIN.regular ||
    family === PLEX_ARABIC.regular ||
    family === PLEX_HEBREW.regular
  ) {
    return 'regular';
  }
  return undefined;
}

/**
 * Flatten a text style onto the locale typeface and drop `fontWeight`.
 * iOS/Android fall back to the system UI face when a custom `fontFamily`
 * file is combined with `fontWeight`.
 *
 * `face: 'latin'` is accepted for call-site compatibility and is a no-op —
 * every Plex family already covers Latin punctuation.
 */
export function applyAppTypeface(
  locale: string,
  style?: StyleProp<TextStyle>,
  opts: {
    weight?: FontWeightToken;
    variant?: TypographyVariantName;
    face?: 'app' | 'latin';
  } = {},
): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (isMonoFamily(flat.fontFamily)) return flat;

  const token =
    opts.weight ??
    (opts.variant ? weightFromVariant(opts.variant) : undefined) ??
    weightTokenFromFontWeight(flat.fontWeight) ??
    weightTokenFromFamily(flat.fontFamily) ??
    'regular';

  const { fontWeight: _fontWeight, fontFamily: _fontFamily, ...rest } = flat;
  void opts.face;
  return {
    ...rest,
    ...resolveAppFontStyle(locale, { weight: token }),
  };
}

/**
 * Final style pass for Arabic `Text`: only lift extremely tight line boxes
 * (hero money). Plex Arabic does not need KO Sans's 1.5 ratio or extra pad.
 */
export function resolveArabicTextMetrics(
  locale: string,
  composed: StyleProp<TextStyle>,
): TextStyle | undefined {
  if (locale !== 'ar') return undefined;

  const flat = StyleSheet.flatten(composed);
  const fontSize = typeof flat?.fontSize === 'number' ? flat.fontSize : 17;
  const lineHeight = typeof flat?.lineHeight === 'number' ? flat.lineHeight : undefined;
  const minLineHeight = Math.ceil(fontSize * AR_MIN_LINE_RATIO);

  const next: TextStyle = {};
  if (lineHeight != null && lineHeight < minLineHeight) {
    next.lineHeight = minLineHeight;
  }
  if (Platform.OS === 'android') {
    next.includeFontPadding = true;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}
