import {
  MAHER_BREAKPOINTS,
  isAtLeast,
  resolveColumnCapacity,
  resolveContentDensity,
  resolveNavigationMode,
  resolveWindowClass,
} from '../breakpoints';

describe('resolveWindowClass', () => {
  it('uses the canonical 600 / 900 / 1200 boundaries', () => {
    expect(MAHER_BREAKPOINTS).toEqual({ medium: 600, expanded: 900, wide: 1200 });
  });

  it.each([
    [0, 'compact'],
    [320, 'compact'],
    [390, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [768, 'medium'],
    [820, 'medium'],
    [834, 'medium'],
    [899, 'medium'],
    [900, 'expanded'],
    [1024, 'expanded'],
    [1194, 'expanded'],
    [1199, 'expanded'],
    [1200, 'wide'],
    [1366, 'wide'],
    [1440, 'wide'],
    [5120, 'wide'],
  ] as const)('%d → %s', (width, expected) => {
    expect(resolveWindowClass(width)).toBe(expected);
  });

  it('treats non-finite widths as compact (never crashes chrome)', () => {
    expect(resolveWindowClass(Number.NaN)).toBe('compact');
    expect(resolveWindowClass(-1)).toBe('compact');
  });

  it('599.9 is still compact and 600 flips to medium', () => {
    expect(resolveWindowClass(599.9)).toBe('compact');
    expect(resolveWindowClass(600)).toBe('medium');
  });
});

describe('resolveNavigationMode', () => {
  it('admin: bottom → rail → sidebar', () => {
    expect(resolveNavigationMode('compact', 'admin')).toBe('bottom');
    expect(resolveNavigationMode('medium', 'admin')).toBe('rail');
    expect(resolveNavigationMode('expanded', 'admin')).toBe('sidebar');
    expect(resolveNavigationMode('wide', 'admin')).toBe('sidebar');
  });

  it('dealer and worker keep bottom chrome on every width', () => {
    for (const wc of ['compact', 'medium', 'expanded', 'wide'] as const) {
      expect(resolveNavigationMode(wc, 'customer')).toBe('bottom');
      expect(resolveNavigationMode(wc, 'employee')).toBe('bottom');
    }
  });
});

describe('capacity / density / ordering', () => {
  it('column capacity grows 1 → 4', () => {
    expect(resolveColumnCapacity('compact')).toBe(1);
    expect(resolveColumnCapacity('medium')).toBe(2);
    expect(resolveColumnCapacity('expanded')).toBe(3);
    expect(resolveColumnCapacity('wide')).toBe(4);
  });

  it('content density names the product feel', () => {
    expect(resolveContentDensity('compact')).toBe('floor');
    expect(resolveContentDensity('medium')).toBe('workstation');
    expect(resolveContentDensity('expanded')).toBe('desk');
    expect(resolveContentDensity('wide')).toBe('command');
  });

  it('isAtLeast follows class order', () => {
    expect(isAtLeast('compact', 'medium')).toBe(false);
    expect(isAtLeast('medium', 'medium')).toBe(true);
    expect(isAtLeast('wide', 'expanded')).toBe(true);
    expect(isAtLeast('expanded', 'wide')).toBe(false);
  });
});
