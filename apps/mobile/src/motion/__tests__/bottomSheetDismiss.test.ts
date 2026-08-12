import {
  SHEET_DISMISS_DISTANCE_CAP,
  SHEET_DISMISS_DISTANCE_RATIO,
  SHEET_DISMISS_VELOCITY,
  shouldDismissSheet,
} from '../BottomSheetTransition';

describe('shouldDismissSheet', () => {
  it('dismisses after a quarter of the sheet height', () => {
    const height = 400;
    const threshold = height * SHEET_DISMISS_DISTANCE_RATIO;
    expect(shouldDismissSheet(threshold, 0, height)).toBe(false);
    expect(shouldDismissSheet(threshold + 1, 0, height)).toBe(true);
  });

  it('caps the distance threshold on tall sheets', () => {
    const height = 800;
    expect(height * SHEET_DISMISS_DISTANCE_RATIO).toBeGreaterThan(SHEET_DISMISS_DISTANCE_CAP);
    expect(shouldDismissSheet(SHEET_DISMISS_DISTANCE_CAP, 0, height)).toBe(false);
    expect(shouldDismissSheet(SHEET_DISMISS_DISTANCE_CAP + 1, 0, height)).toBe(true);
  });

  it('uses a smaller distance on short sheets', () => {
    const height = 200;
    const threshold = height * SHEET_DISMISS_DISTANCE_RATIO;
    expect(threshold).toBeLessThan(SHEET_DISMISS_DISTANCE_CAP);
    expect(shouldDismissSheet(threshold, 0, height)).toBe(false);
    expect(shouldDismissSheet(threshold + 1, 0, height)).toBe(true);
  });

  it('dismisses on a fast downward flick', () => {
    expect(shouldDismissSheet(8, SHEET_DISMISS_VELOCITY, 400)).toBe(false);
    expect(shouldDismissSheet(8, SHEET_DISMISS_VELOCITY + 1, 400)).toBe(true);
  });

  it('never dismisses an upward drag', () => {
    expect(shouldDismissSheet(-80, 0, 400)).toBe(false);
    expect(shouldDismissSheet(-80, SHEET_DISMISS_VELOCITY + 500, 400)).toBe(false);
    expect(shouldDismissSheet(0, SHEET_DISMISS_VELOCITY + 500, 400)).toBe(false);
  });

  it('does not dismiss when height is missing', () => {
    expect(shouldDismissSheet(80, SHEET_DISMISS_VELOCITY + 1, 0)).toBe(false);
    expect(shouldDismissSheet(80, SHEET_DISMISS_VELOCITY + 1, -10)).toBe(false);
  });
});
