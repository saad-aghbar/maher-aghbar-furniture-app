import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  it('exports a hook function', () => {
    expect(typeof useDebouncedValue).toBe('function');
  });
});
