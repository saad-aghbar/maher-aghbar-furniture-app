import {
  SURFACE_TAB_BAR_CLEARANCE,
  surfaceTabBarStackInset,
} from '../tabBarClearance';

describe('surfaceTabBarStackInset', () => {
  it('adds the home-indicator inset on top of tab-bar clearance', () => {
    expect(surfaceTabBarStackInset(34, 8)).toBe(SURFACE_TAB_BAR_CLEARANCE + 34);
  });

  it('uses minGap when the safe-area inset is zero', () => {
    expect(surfaceTabBarStackInset(0, 8)).toBe(SURFACE_TAB_BAR_CLEARANCE + 8);
  });
});
