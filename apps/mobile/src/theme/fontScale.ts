import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

export const FONT_SCALE_MIN = 0.85;
export const FONT_SCALE_DEFAULT = 1;
export const FONT_SCALE_MAX = 1.4;
export const FONT_SCALE_STORAGE_KEY = 'maher.fontScale';

/** Finger must enter this window (progress 0–1) to catch the default detent. */
export const FONT_SCALE_DEFAULT_SNAP_IN = 0.05;
/** Once caught, finger must leave this wider window to escape default. */
export const FONT_SCALE_DEFAULT_SNAP_OUT = 0.11;
/** @deprecated use FONT_SCALE_DEFAULT_SNAP_IN */
export const FONT_SCALE_DEFAULT_SNAP = FONT_SCALE_DEFAULT_SNAP_IN;

export function isNearDefaultProgress(progress: number, threshold: number): boolean {
  'worklet';
  return Math.abs(progress - 0.5) <= threshold;
}

/**
 * Magnetic default at 0.5. Stick while latched until the finger leaves SNAP_OUT.
 */
export function applyDefaultSnap(
  raw: number,
  latched: number,
): { progress: number; latched: number; snappedIn: boolean } {
  'worklet';
  const p = Math.min(1, Math.max(0, raw));
  if (latched) {
    if (Math.abs(p - 0.5) > FONT_SCALE_DEFAULT_SNAP_OUT) {
      return { progress: p, latched: 0, snappedIn: false };
    }
    return { progress: 0.5, latched: 1, snappedIn: false };
  }
  if (Math.abs(p - 0.5) <= FONT_SCALE_DEFAULT_SNAP_IN) {
    return { progress: 0.5, latched: 1, snappedIn: true };
  }
  return { progress: p, latched: 0, snappedIn: false };
}

export function clampFontScale(value: number): number {
  'worklet';
  if (!Number.isFinite(value)) return FONT_SCALE_DEFAULT;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value));
}

export function roundFontScale(value: number): number {
  'worklet';
  return Math.round(clampFontScale(value) * 100) / 100;
}

/**
 * Slider 0..1 with visual center = default 1.0.
 * Left half: 0.85 → 1.00. Right half: 1.00 → 1.40.
 */
export function progressToFontScale(progress: number): number {
  'worklet';
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0.5) {
    const t = p / 0.5;
    return roundFontScale(FONT_SCALE_MIN + t * (FONT_SCALE_DEFAULT - FONT_SCALE_MIN));
  }
  const t = (p - 0.5) / 0.5;
  return roundFontScale(FONT_SCALE_DEFAULT + t * (FONT_SCALE_MAX - FONT_SCALE_DEFAULT));
}

export function fontScaleToProgress(scale: number): number {
  'worklet';
  const s = clampFontScale(scale);
  if (s <= FONT_SCALE_DEFAULT) {
    const span = FONT_SCALE_DEFAULT - FONT_SCALE_MIN;
    return span === 0 ? 0.5 : ((s - FONT_SCALE_MIN) / span) * 0.5;
  }
  const span = FONT_SCALE_MAX - FONT_SCALE_DEFAULT;
  return span === 0 ? 0.5 : 0.5 + ((s - FONT_SCALE_DEFAULT) / span) * 0.5;
}

export function parseStoredFontScale(raw: string | null | undefined): number {
  if (raw == null || raw === '') return FONT_SCALE_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return FONT_SCALE_DEFAULT;
  return roundFontScale(n);
}

/** Multiply final fontSize + lineHeight after flatten. Leaves other keys intact. */
export function scaleTextStyle(
  style: StyleProp<TextStyle> | undefined,
  scale: number,
): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const s = roundFontScale(scale);
  if (s === FONT_SCALE_DEFAULT) return flat;
  const next: TextStyle = { ...flat };
  if (typeof next.fontSize === 'number') {
    next.fontSize = Math.round(next.fontSize * s);
  }
  if (typeof next.lineHeight === 'number') {
    next.lineHeight = Math.round(next.lineHeight * s);
  }
  return next;
}

export function chromeSize(base: number, scale: number): number {
  return Math.max(1, Math.round(base * roundFontScale(scale)));
}
