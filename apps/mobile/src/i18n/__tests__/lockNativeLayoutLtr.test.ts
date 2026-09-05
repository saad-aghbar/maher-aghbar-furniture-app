import { I18nManager } from 'react-native';
import { lockNativeLayoutLtr } from '../lockNativeLayoutLtr';

describe('lockNativeLayoutLtr', () => {
  const original = {
    allowRTL: I18nManager.allowRTL,
    forceRTL: I18nManager.forceRTL,
    swapLeftAndRightInRTL: I18nManager.swapLeftAndRightInRTL,
  };
  let isRtl = false;
  const allowRTL = jest.fn((_next: boolean) => {
    /* allowRTL does not flip isRTL by itself */
  });
  const forceRTL = jest.fn((next: boolean) => {
    isRtl = next;
  });
  const swapLeftAndRightInRTL = jest.fn();

  beforeEach(() => {
    isRtl = false;
    allowRTL.mockClear();
    forceRTL.mockClear();
    swapLeftAndRightInRTL.mockClear();
    Object.defineProperty(I18nManager, 'isRTL', {
      configurable: true,
      get: () => isRtl,
    });
    I18nManager.allowRTL = allowRTL;
    I18nManager.forceRTL = forceRTL;
    I18nManager.swapLeftAndRightInRTL = swapLeftAndRightInRTL;
  });

  afterEach(() => {
    I18nManager.allowRTL = original.allowRTL;
    I18nManager.forceRTL = original.forceRTL;
    I18nManager.swapLeftAndRightInRTL = original.swapLeftAndRightInRTL;
  });

  it('keeps native LTR when already LTR', () => {
    expect(lockNativeLayoutLtr()).toBe(false);
    expect(allowRTL).toHaveBeenCalledWith(false);
    expect(swapLeftAndRightInRTL).toHaveBeenCalledWith(false);
    expect(forceRTL).not.toHaveBeenCalled();
  });

  it('turns native RTL off so JS RTL is not double-flipped', () => {
    isRtl = true;
    expect(lockNativeLayoutLtr()).toBe(true);
    expect(allowRTL).toHaveBeenCalledWith(false);
    expect(forceRTL).toHaveBeenCalledWith(false);
  });
});
