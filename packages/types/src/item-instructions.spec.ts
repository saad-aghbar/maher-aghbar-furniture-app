import { joinTrilingualNotes, pickLocalizedInstruction } from './item-instructions';

describe('item instructions', () => {
  it('joins non-empty languages with newlines', () => {
    expect(joinTrilingualNotes('لف بسيط', 'Simple wrap', null)).toBe('لف بسيط\nSimple wrap');
    expect(joinTrilingualNotes('  ', '', null)).toBeNull();
  });

  it('picks Arabic first for ar, English for en, Hebrew with Arabic fallback', () => {
    expect(pickLocalizedInstruction('ar', 'عربي', 'English', 'עברית')).toBe('عربي');
    expect(pickLocalizedInstruction('en', 'عربي', 'English', 'עברית')).toBe('English');
    expect(pickLocalizedInstruction('he', null, 'English', 'עברית')).toBe('עברית');
    expect(pickLocalizedInstruction('en', 'عربي', null, null)).toBe('عربي');
  });
});
