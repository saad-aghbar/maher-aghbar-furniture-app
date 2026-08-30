import { I18nManager } from 'react-native';
import {
  alignStart,
  extraStartPadding,
  flexDirectionFor,
  isRtlLocale,
  localeRow,
  mirrorStyle,
  pinStart,
  textAlignFor,
  writingDirectionFor,
} from '../rtl';

describe('rtl helpers', () => {
  it('detects RTL locales', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('he')).toBe(true);
    expect(isRtlLocale('en')).toBe(false);
  });

  it('maps text and flex direction without double-flipping native RTL', () => {
    expect(textAlignFor('rtl')).toBe('right');
    expect(textAlignFor('ltr')).toBe('left');
    expect(writingDirectionFor(true)).toBe('rtl');
    expect(writingDirectionFor(false)).toBe('ltr');
    // Jest's I18nManager is LTR, so locale RTL must reverse.
    expect(I18nManager.isRTL).toBe(false);
    expect(flexDirectionFor('rtl')).toBe('row-reverse');
    expect(flexDirectionFor('ltr')).toBe('row');
    expect(localeRow(true)).toBe('row-reverse');
    expect(localeRow(false)).toBe('row');
  });

  it('pins and pads the start edge for the active locale', () => {
    expect(pinStart(false)).toEqual({ start: 0 });
    expect(pinStart(true)).toEqual({ right: 0 });
    expect(extraStartPadding(false, 4)).toEqual({ paddingStart: 4 });
    expect(extraStartPadding(true, 4)).toEqual({ paddingRight: 4 });
    expect(alignStart(true)).toBe('flex-end');
    expect(alignStart(false)).toBe('flex-start');
  });

  it('mirrors only when RTL', () => {
    expect(mirrorStyle(false)).toBeUndefined();
    expect(mirrorStyle(true)).toEqual({ transform: [{ scaleX: -1 }] });
  });
});
