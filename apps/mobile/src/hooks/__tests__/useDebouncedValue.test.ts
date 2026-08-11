import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  it('exports a hook function used by catalog search', () => {
    expect(typeof useDebouncedValue).toBe('function');
  });
});
