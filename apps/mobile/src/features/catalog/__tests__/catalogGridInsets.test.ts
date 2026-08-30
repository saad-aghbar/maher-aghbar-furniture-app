import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import {
  adminCatalogFabBottom,
  adminCatalogListBottomPad,
} from '../catalogGridInsets';

describe('admin catalog grid insets', () => {
  it('last-content pad is insets.bottom + SURFACE_TAB_BAR_CLEARANCE', () => {
    expect(adminCatalogListBottomPad(34)).toBe(34 + SURFACE_TAB_BAR_CLEARANCE);
  });

  it('adds FAB extra so the last row can scroll clear of the +', () => {
    const fabExtra = 56 + 12;
    expect(adminCatalogListBottomPad(34, fabExtra)).toBe(
      34 + SURFACE_TAB_BAR_CLEARANCE + fabExtra,
    );
  });

  it('FAB bottom matches the tab-clearance line', () => {
    expect(adminCatalogFabBottom(34)).toBe(34 + SURFACE_TAB_BAR_CLEARANCE);
  });
});
