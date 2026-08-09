import type { Href } from 'expo-router';
import { navigateToTab, tabHref } from '../navigateToTab';

describe('navigateToTab', () => {
  it('builds tab hrefs', () => {
    expect(tabHref('admin', 'index')).toBe('/(app)/(admin)/(tabs)');
    expect(tabHref('admin', 'orders')).toBe('/(app)/(admin)/(tabs)/orders');
    expect(tabHref('admin', 'more')).toBe('/(app)/(admin)/(tabs)/more');
  });

  it('no-ops when already on that tab root', () => {
    const router = {
      navigate: jest.fn(),
      replace: jest.fn(),
      canDismiss: jest.fn(() => true),
      dismissAll: jest.fn(),
    };
    navigateToTab(router, 'admin', 'more', '/more');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.dismissAll).not.toHaveBeenCalled();
  });

  it('clears nested stack then navigates when leaving a detail screen', () => {
    const router = {
      navigate: jest.fn(),
      replace: jest.fn(),
      canDismiss: jest.fn(() => true),
      dismissAll: jest.fn(),
    };
    navigateToTab(router, 'admin', 'more', '/requests/rfq-1');
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith('/(app)/(admin)/(tabs)/more' as Href);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces when nested but nothing to dismiss', () => {
    const router = {
      navigate: jest.fn(),
      replace: jest.fn(),
      canDismiss: jest.fn(() => false),
      dismissAll: jest.fn(),
    };
    navigateToTab(router, 'admin', 'orders', '/orders/abc');
    expect(router.replace).toHaveBeenCalledWith('/(app)/(admin)/(tabs)/orders' as Href);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.dismissAll).not.toHaveBeenCalled();
  });

  it('navigates between tab roots without dismissing', () => {
    const router = {
      navigate: jest.fn(),
      replace: jest.fn(),
      canDismiss: jest.fn(() => true),
      dismissAll: jest.fn(),
    };
    navigateToTab(router, 'admin', 'more', '/orders');
    expect(router.navigate).toHaveBeenCalledWith('/(app)/(admin)/(tabs)/more' as Href);
    expect(router.dismissAll).not.toHaveBeenCalled();
  });
});
