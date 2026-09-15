import type { Href } from 'expo-router';
import { navigateSurfaceHref } from '../navigateSurfaceHref';

const ORDER_HREF = '/(app)/(admin)/orders/abc' as Href;

describe('navigateSurfaceHref', () => {
  it('dismisses a nested stack layer then navigates', () => {
    const router = {
      navigate: jest.fn(),
      canDismiss: jest.fn(() => true),
      dismissAll: jest.fn(),
    };
    navigateSurfaceHref(router, ORDER_HREF);
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(ORDER_HREF);
  });

  it('navigates without dismissing on a tab root', () => {
    const router = {
      navigate: jest.fn(),
      canDismiss: jest.fn(() => false),
      dismissAll: jest.fn(),
    };
    navigateSurfaceHref(router, ORDER_HREF);
    expect(router.dismissAll).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(ORDER_HREF);
  });
});
