import { shouldSkipQueryErrorToast } from '../queryErrorToast';

describe('shouldSkipQueryErrorToast', () => {
  it('skips only when meta.skipErrorToast is true', () => {
    expect(shouldSkipQueryErrorToast(undefined)).toBe(false);
    expect(shouldSkipQueryErrorToast({})).toBe(false);
    expect(shouldSkipQueryErrorToast({ skipErrorToast: false })).toBe(false);
    expect(shouldSkipQueryErrorToast({ skipErrorToast: true })).toBe(true);
  });
});
