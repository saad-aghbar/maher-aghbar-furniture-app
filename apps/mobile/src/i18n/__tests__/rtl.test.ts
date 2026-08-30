import { I18nManager } from 'react-native';
import {
  alignStart,
  arrowForwardName,
  chevronForwardName,
  endEdge,
  extraStartPadding,
  flexDirectionFor,
  isRtlLocale,
  localeRow,
  mirrorStyle,
  pinStart,
  rowDirection,
  startEdge,
  textAlignFor,
  writingDirectionFor,
} from '../rtl';

function setNativeRtl(value: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', {
    configurable: true,
    get: () => value,
  });
}

describe('rtl helpers', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(I18nManager, 'isRTL');

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(I18nManager, 'isRTL', originalDescriptor);
    } else {
      setNativeRtl(false);
    }
  });

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

  it('maps writingDirection from in-app locale', () => {
    expect(writingDirectionFor(true)).toBe('rtl');
    expect(writingDirectionFor(false)).toBe('ltr');
  });

  it('uses row when locale matches I18nManager (avoids double-flip)', () => {
    setNativeRtl(false);
    expect(rowDirection(false)).toBe('row');
    expect(localeRow(false)).toBe('row');
    setNativeRtl(true);
    expect(rowDirection(true)).toBe('row');
    expect(localeRow(true)).toBe('row');
  });

  it('reverses only when locale disagrees with I18nManager', () => {
    setNativeRtl(false);
    expect(rowDirection(true)).toBe('row-reverse');
    setNativeRtl(true);
    expect(rowDirection(false)).toBe('row-reverse');
  });

  it('names start-edge chevrons and arrows', () => {
    expect(chevronForwardName(false)).toBe('chevron-forward');
    expect(chevronForwardName(true)).toBe('chevron-back');
    expect(arrowForwardName(false)).toBe('arrow-forward');
    expect(arrowForwardName(true)).toBe('arrow-back');
  });

  it('maps physical start/end for absolute chrome', () => {
    expect(startEdge(false)).toBe('left');
    expect(startEdge(true)).toBe('right');
    expect(endEdge(false)).toBe('right');
    expect(endEdge(true)).toBe('left');
  });

  it('mirrors only when RTL', () => {
    expect(mirrorStyle(false)).toBeUndefined();
    expect(mirrorStyle(true)).toEqual({ transform: [{ scaleX: -1 }] });
  });
});
