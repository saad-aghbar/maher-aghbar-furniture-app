import {
  Platform,
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import type { FontWeightToken, TypographyVariantName } from './types';

/**
 * Brand Arabic typeface — KO Sans (Boharat / Kotype).
 * Loaded via expo-font; PostScript names match the OTF `name` table.
 */
export const KO_SANS = {
  regular: 'KOSans-Regular',
  medium: 'KOSans-Medium',
  semibold: 'KOSans-SemiBold',
} as const;

/**
 * Latin + Hebrew typeface — Rubik (SIL OFL). Same files cover both scripts
 * so mixed English/Hebrew strings stay on one face.
 */
export const RUBIK = {
  regular: 'Rubik-Regular',
  medium: 'Rubik-Medium',
  semibold: 'Rubik-SemiBold',
} as const;

/**
 * KO Sans glyph boxes sit above Latin metric line boxes on React Native.
 * Tight `lineHeight` (common for hero money) crops Arabic ascenders and
 * Latin digits/currency when the UI is in Arabic.
 */
const AR_MIN_LINE_RATIO = 1.5;

export type KoSansFamily = (typeof KO_SANS)[keyof typeof KO_SANS];
export type RubikFamily = (typeof RUBIK)[keyof typeof RUBIK];
export type AppFontFamily = KoSansFamily | RubikFamily;

/** expo-font map — keys become `fontFamily` values. */
export const koSansFontSources: Record<KoSansFamily, number> = {
  [KO_SANS.regular]: require('../../assets/fonts/KOSans-Regular.otf'),
  [KO_SANS.medium]: require('../../assets/fonts/KOSans-Medium.otf'),
  [KO_SANS.semibold]: require('../../assets/fonts/KOSans-SemiBold.otf'),
};

export const rubikFontSources: Record<RubikFamily, number> = {
  [RUBIK.regular]: require('../../assets/fonts/Rubik-Regular.ttf'),
  [RUBIK.medium]: require('../../assets/fonts/Rubik-Medium.ttf'),
  [RUBIK.semibold]: require('../../assets/fonts/Rubik-SemiBold.ttf'),
};

const koSansWeightToFamily: Record<FontWeightToken, KoSansFamily> = {
  regular: KO_SANS.regular,
  medium: KO_SANS.medium,
  semibold: KO_SANS.semibold,
};

const rubikWeightToFamily: Record<FontWeightToken, RubikFamily> = {
  regular: RUBIK.regular,
  medium: RUBIK.medium,
  semibold: RUBIK.semibold,
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

/** KO Sans SemiBold reads heavy at phone sizes — step Arabic weights down one. */
function softenArabicWeight(weight: FontWeightToken): FontWeightToken {
  if (weight === 'semibold') return 'medium';
  if (weight === 'medium') return 'regular';
  return 'regular';
}

/**
 * Resolve the app typeface for the active locale.
 * Arabic → KO Sans (weights softened). English / Hebrew → Rubik (1:1 weights).
 *
 * UI uses Regular / Medium / SemiBold — KO Sans Thin is print-sample only; at
 * phone sizes it reads as disconnected strokes.
 */
export function resolveAppFontFamily(
  locale: string,
  opts: { weight?: FontWeightToken; variant?: TypographyVariantName } = {},
): AppFontFamily {
  const { weight, variant } = opts;
  const token = weight ?? weightFromVariant(variant);
  if (locale === 'ar') {
    return koSansWeightToFamily[softenArabicWeight(token)];
  }
  return rubikWeightToFamily[token];
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
  if (family === KO_SANS.semibold || family === RUBIK.semibold) return 'semibold';
  if (family === KO_SANS.medium || family === RUBIK.medium) return 'medium';
  if (family === KO_SANS.regular || family === RUBIK.regular) return 'regular';
  return undefined;
}

/**
 * Flatten a text style onto the locale typeface and drop `fontWeight`.
 * iOS/Android fall back to the system UI face when a custom `fontFamily`
 * file is combined with `fontWeight` — that is why some labels still
 * looked like San Francisco / Roboto after Rubik loaded.
 */
export function applyAppTypeface(
  locale: string,
  style?: StyleProp<TextStyle>,
  opts: { weight?: FontWeightToken; variant?: TypographyVariantName } = {},
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
  return {
    ...rest,
    ...resolveAppFontStyle(locale, { weight: token }),
  };
}

/**
 * Final style pass for Arabic `Text`: ensure the native line box is tall
 * enough that KO Sans (and Latin numerals rendered with it) are not clipped.
 * Apply after variant + caller styles are composed.
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
  const minPadTop = Math.max(2, Math.round(fontSize * 0.08));

  const existingPadTop =
    typeof flat?.paddingTop === 'number'
      ? flat.paddingTop
      : typeof flat?.paddingVertical === 'number'
        ? flat.paddingVertical
        : typeof flat?.padding === 'number'
          ? flat.padding
          : 0;

  const next: TextStyle = {};
  if (lineHeight == null || lineHeight < minLineHeight) {
    next.lineHeight = minLineHeight;
  }
  if (existingPadTop < minPadTop) {
    next.paddingTop = minPadTop;
  }
  if (Platform.OS === 'android') {
    next.includeFontPadding = true;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}
