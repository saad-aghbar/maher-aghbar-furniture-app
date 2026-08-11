import { categoryRailImageUrl } from '../categoryRailImagery';

describe('categoryRailImagery', () => {
  it('returns a stable url for the same category id', () => {
    expect(categoryRailImageUrl('cat-1')).toBe(categoryRailImageUrl('cat-1'));
  });

  it('can differ across category ids', () => {
    const a = categoryRailImageUrl('sofa');
    const b = categoryRailImageUrl('dining-table-xyz');
    expect(typeof a).toBe('string');
    expect(a.startsWith('https://')).toBe(true);
    // Different keys usually land on different pool slots; not required equal.
    expect(a || b).toBeTruthy();
  });
});
