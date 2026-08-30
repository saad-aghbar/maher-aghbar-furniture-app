import {
  SURFACE_TAB_BAR_CLEARANCE,
  surfaceTabBarStackInset,
} from '../tabBarClearance';

<<<<<<< HEAD
describe('surfaceTabBarStackInset', () => {
  it('adds the home-indicator inset on top of tab-bar clearance', () => {
    expect(surfaceTabBarStackInset(34, 8)).toBe(SURFACE_TAB_BAR_CLEARANCE + 34);
  });

  it('uses minGap when the safe-area inset is zero', () => {
    expect(surfaceTabBarStackInset(0, 8)).toBe(SURFACE_TAB_BAR_CLEARANCE + 8);
=======
describe('surfaceListBottomInset', () => {
  it('is insets.bottom + SURFACE_TAB_BAR_CLEARANCE', () => {
    expect(surfaceListBottomInset(34)).toBe(SURFACE_TAB_BAR_CLEARANCE + 34);
  });

  it('does not shrink when the safe-area inset is missing', () => {
    expect(surfaceListBottomInset(0)).toBe(SURFACE_TAB_BAR_CLEARANCE);
    expect(surfaceListBottomInset(-8)).toBe(SURFACE_TAB_BAR_CLEARANCE);
>>>>>>> 966cda8 (fix(mobile): Staff Types last-card inset and sentence-case labels)
  });
});
