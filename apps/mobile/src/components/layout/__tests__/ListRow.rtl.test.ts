import { chevronForwardName, rowDirection, textAlignFor } from '@/i18n/rtl';
import { I18nManager } from 'react-native';

function setNativeRtl(value: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', {
    configurable: true,
    get: () => value,
  });
}

describe('ListRow RTL chrome', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(I18nManager, 'isRTL');

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(I18nManager, 'isRTL', originalDescriptor);
    } else {
      setNativeRtl(false);
    }
  });

  it('flips row direction without double-reversing I18nManager', () => {
    setNativeRtl(false);
    expect(rowDirection(true)).toBe('row-reverse');
    expect(rowDirection(false)).toBe('row');
    setNativeRtl(true);
    expect(rowDirection(true)).toBe('row');
    expect(textAlignFor('rtl')).toBe('right');
    expect(textAlignFor('ltr')).toBe('left');
  });

  it('uses the start-edge chevron name in RTL', () => {
    expect(chevronForwardName(false)).toBe('chevron-forward');
    expect(chevronForwardName(true)).toBe('chevron-back');
  });
});
