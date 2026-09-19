import {
  sheetIsDeskWidth,
  sheetNestedListHeight,
  sheetPickerHeight,
  sheetScrollListHeight,
} from '../sheetListViewport';

describe('sheet list viewport', () => {
  it('gives phone pickers a taller sheet and catalog list than the old 560/320 caps', () => {
    expect(sheetPickerHeight(844, false)).toBeGreaterThan(680);
    expect(sheetScrollListHeight(844, false)).toBeGreaterThanOrEqual(300);
    expect(sheetNestedListHeight(844, false)).toBeGreaterThanOrEqual(240);
  });

  it('gives iPad desk pickers a taller sheet and list than phone', () => {
    expect(sheetIsDeskWidth(1024)).toBe(true);
    expect(sheetIsDeskWidth(390)).toBe(false);
    expect(sheetPickerHeight(1024, true)).toBeGreaterThan(sheetPickerHeight(844, false));
    expect(sheetScrollListHeight(1024, true)).toBeGreaterThan(sheetScrollListHeight(844, false));
    expect(sheetNestedListHeight(1024, true)).toBeGreaterThan(sheetNestedListHeight(844, false));
    expect(sheetScrollListHeight(1024, true)).toBeGreaterThanOrEqual(400);
  });
});
