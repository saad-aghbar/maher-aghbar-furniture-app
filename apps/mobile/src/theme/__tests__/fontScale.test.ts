import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  applyDefaultSnap,
  chromeSize,
  clampFontScale,
  fontScaleToProgress,
  parseStoredFontScale,
  progressToFontScale,
  roundFontScale,
  scaleTextStyle,
} from '../fontScale';

describe('clampFontScale / roundFontScale', () => {
  it('clamps to the allowed range', () => {
    expect(clampFontScale(0.2)).toBe(FONT_SCALE_MIN);
    expect(clampFontScale(3)).toBe(FONT_SCALE_MAX);
    expect(clampFontScale(1)).toBe(1);
  });

  it('treats non-finite as default', () => {
    expect(clampFontScale(Number.NaN)).toBe(FONT_SCALE_DEFAULT);
    expect(clampFontScale(Number.POSITIVE_INFINITY)).toBe(FONT_SCALE_DEFAULT);
  });

  it('rounds to two decimals', () => {
    expect(roundFontScale(1.234)).toBe(1.23);
    expect(roundFontScale(1.236)).toBe(1.24);
  });
});

describe('progress ↔ scale mapping', () => {
  it('maps the visual center to default 1.0', () => {
    expect(progressToFontScale(0.5)).toBe(FONT_SCALE_DEFAULT);
    expect(fontScaleToProgress(FONT_SCALE_DEFAULT)).toBe(0.5);
  });

  it('maps the ends to min and max', () => {
    expect(progressToFontScale(0)).toBe(FONT_SCALE_MIN);
    expect(progressToFontScale(1)).toBe(FONT_SCALE_MAX);
    expect(fontScaleToProgress(FONT_SCALE_MIN)).toBe(0);
    expect(fontScaleToProgress(FONT_SCALE_MAX)).toBe(1);
  });

  it('round-trips through the center-weighted curve', () => {
    for (const scale of [0.85, 0.92, 1, 1.1, 1.25, 1.4]) {
      const progress = fontScaleToProgress(scale);
      expect(progressToFontScale(progress)).toBe(roundFontScale(scale));
    }
  });
});

describe('applyDefaultSnap', () => {
  it('catches the default when the finger is close to center', () => {
    expect(applyDefaultSnap(0.5, 0)).toEqual({ progress: 0.5, latched: 1, snappedIn: true });
    expect(applyDefaultSnap(0.52, 0)).toEqual({ progress: 0.5, latched: 1, snappedIn: true });
    expect(applyDefaultSnap(0.48, 0)).toEqual({ progress: 0.5, latched: 1, snappedIn: true });
  });

  it('does not catch when still a bit away', () => {
    const far = applyDefaultSnap(0.62, 0);
    expect(far.latched).toBe(0);
    expect(far.progress).toBe(0.62);
    expect(far.snappedIn).toBe(false);
  });

  it('stays latched until the finger leaves the wider escape window', () => {
    expect(applyDefaultSnap(0.58, 1)).toEqual({ progress: 0.5, latched: 1, snappedIn: false });
    const escaped = applyDefaultSnap(0.7, 1);
    expect(escaped.latched).toBe(0);
    expect(escaped.progress).toBe(0.7);
  });
});

describe('parseStoredFontScale', () => {
  it('returns default for missing or invalid values', () => {
    expect(parseStoredFontScale(null)).toBe(FONT_SCALE_DEFAULT);
    expect(parseStoredFontScale(undefined)).toBe(FONT_SCALE_DEFAULT);
    expect(parseStoredFontScale('')).toBe(FONT_SCALE_DEFAULT);
    expect(parseStoredFontScale('nope')).toBe(FONT_SCALE_DEFAULT);
    expect(parseStoredFontScale('NaN')).toBe(FONT_SCALE_DEFAULT);
  });

  it('clamps stored numbers', () => {
    expect(parseStoredFontScale('1.15')).toBe(1.15);
    expect(parseStoredFontScale('0.1')).toBe(FONT_SCALE_MIN);
    expect(parseStoredFontScale('9')).toBe(FONT_SCALE_MAX);
  });
});

describe('scaleTextStyle', () => {
  it('multiplies fontSize and lineHeight', () => {
    expect(scaleTextStyle({ fontSize: 10, lineHeight: 14, color: '#111' }, 1.4)).toEqual({
      fontSize: 14,
      lineHeight: 20,
      color: '#111',
    });
  });

  it('leaves non-numeric metrics alone and no-ops at default scale', () => {
    const style = { fontSize: 12, fontWeight: '600' as const };
    expect(scaleTextStyle(style, 1)).toMatchObject({ fontSize: 12, fontWeight: '600' });
    expect(scaleTextStyle({ color: 'red' }, 1.3)).toEqual({ color: 'red' });
  });
});

describe('chromeSize', () => {
  it('rounds scaled chrome', () => {
    expect(chromeSize(40, 1)).toBe(40);
    expect(chromeSize(40, 1.4)).toBe(56);
  });
});
