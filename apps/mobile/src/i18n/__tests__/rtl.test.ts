import { flexDirectionFor, isRtlLocale, mirrorStyle, textAlignFor } from '../rtl';

describe('rtl helpers', () => {
  it('detects RTL locales', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('he')).toBe(true);
    expect(isRtlLocale('en')).toBe(false);
  });

  it('maps text and flex direction', () => {
    expect(textAlignFor('rtl')).toBe('right');
    expect(textAlignFor('ltr')).toBe('left');
    expect(flexDirectionFor('rtl')).toBe('row-reverse');
    expect(flexDirectionFor('ltr')).toBe('row');
  });

  it('mirrors only when RTL', () => {
    expect(mirrorStyle(false)).toBeUndefined();
    expect(mirrorStyle(true)).toEqual({ transform: [{ scaleX: -1 }] });
  });
});
