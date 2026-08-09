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
 * KO Sans glyph boxes sit above Latin metric line boxes on React Native.
 * Tight `lineHeight` (common for hero money) crops Arabic ascenders and
 * Latin digits/currency when the UI is in Arabic.
 */
const AR_MIN_LINE_RATIO = 1.5;

export type KoSansFamily = (typeof KO_SANS)[keyof typeof KO_SANS];

/** expo-font map — keys become `fontFamily` values. */
export const koSansFontSources: Record<KoSansFamily, number> = {
  [KO_SANS.regular]: require('../../assets/fonts/KOSans-Regular.otf'),
  [KO_SANS.medium]: require('../../assets/fonts/KOSans-Medium.otf'),
  [KO_SANS.semibold]: require('../../assets/fonts/KOSans-SemiBold.otf'),
};

const weightToFamily: Record<FontWeightToken, KoSansFamily> = {
  regular: KO_SANS.regular,
  medium: KO_SANS.medium,
  semibold: KO_SANS.semibold,
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
 * Resolve KO Sans family for Arabic. Returns undefined for other locales
 * (system / Latin stack).
 *
 * UI uses Regular / Medium / SemiBold — Thin is print-sample only; at phone
 * sizes it reads as disconnected strokes.
 */
export function resolveAppFontFamily(
  locale: string,
  opts: { weight?: FontWeightToken; variant?: TypographyVariantName } = {},
): KoSansFamily | undefined {
  if (locale !== 'ar') return undefined;
  const { weight, variant } = opts;
  const resolved = softenArabicWeight(weight ?? weightFromVariant(variant));
  return weightToFamily[resolved];
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
    /** Fallback system weight when not Arabic. */
    systemWeight?: NonNullable<TextStyle['fontWeight']>;
  } = {},
): TextStyle {
  const family = resolveAppFontFamily(locale, opts);
  if (family) {
    return { fontFamily: family, letterSpacing: 0 };
  }
  if (opts.systemWeight) return { fontWeight: opts.systemWeight };
  return {};
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
