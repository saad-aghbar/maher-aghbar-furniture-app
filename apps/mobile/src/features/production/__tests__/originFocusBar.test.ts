import { nextOriginFocus, originFocusToParam } from '../components/OriginFocusBar';

describe('nextOriginFocus', () => {
  it('selects the tapped cell and keeps All explicit', () => {
    expect(nextOriginFocus('all', 'returned')).toBe('returned');
    expect(nextOriginFocus('returned', 'returned')).toBe('returned');
    expect(nextOriginFocus('returned', 'all')).toBe('all');
    expect(nextOriginFocus('returned', 'normal')).toBe('normal');
  });
});

describe('originFocusToParam', () => {
  it('omits All from the wire and keeps Normal / Returned', () => {
    expect(originFocusToParam('all')).toBeUndefined();
    expect(originFocusToParam('normal')).toBe('normal');
    expect(originFocusToParam('returned')).toBe('returned');
  });
});
