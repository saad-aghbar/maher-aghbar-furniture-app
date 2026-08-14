import type { AuthUser } from '@maher/types';
import {
  DEALER_NEW_ORDER_A11Y_KEY,
  DEALER_NEW_ORDER_HREF,
} from '@/features/dealer-ui/dealerFabConstants';
import { customerNewOrderTab, visibleTabsForUser } from '../tabConfig';

const base: AuthUser = {
  id: '1',
  username: 'dealer',
  email: 'a@b.c',
  name: 'Dealer',
  roles: [],
  permissions: [],
  preferredLanguage: 'en',
};

describe('dealer FAB integration', () => {
  it('targets the hidden new-order tab route', () => {
    // Route is registered for deep links / FAB; not a visible equal-width chip.
    expect(DEALER_NEW_ORDER_HREF).toBe('/(app)/(customer)/(tabs)/new-order');
    expect(customerNewOrderTab.name).toBe('new-order');
    expect(customerNewOrderTab.labelKey).toBe('newOrder');
  });

  it('uses mobile.tabs.newOrder for a11y (RTL-safe via t())', () => {
    // Label is resolved through i18n — LTR/RTL layout is handled by LocaleProvider,
    // not by hardcoding English in the FAB component.
    expect(DEALER_NEW_ORDER_A11Y_KEY).toBe('mobile.tabs.newOrder');
  });

  it('excludes new-order from customer visible tabs', () => {
    const dealer: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['catalog.read', 'request.create', 'sales-order.read'],
    };
    const names = visibleTabsForUser('customer', dealer).map((t) => t.name);
    expect(names).toEqual(['index', 'catalog', 'orders', 'account']);
    expect(names).not.toContain('new-order');
    // RTL note: floating pill uses flexDirection row-reverse under isRTL;
    // FAB stays center-slotted between catalog and orders regardless of locale.
  });
});
