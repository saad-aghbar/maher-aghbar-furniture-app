import { findEnglishLiteralLeaks } from '../englishLiteralSweep';

describe('English literal sweep', () => {
  it('fails on new user-visible English echo fallbacks and a11y literals', () => {
    expect(findEnglishLiteralLeaks()).toEqual([]);
  });
});
