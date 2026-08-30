import {
  chipsLookLikeSameLabel,
  humanizeOrderChip,
  normalizeChipKey,
} from '../humanizeOrderChip';

describe('humanizeOrderChip', () => {
  it('normalizes leftover enum spellings to a status key', () => {
    expect(normalizeChipKey('Spec incomplete')).toBe('SPEC_INCOMPLETE');
    expect(normalizeChipKey('spec-incomplete')).toBe('SPEC_INCOMPLETE');
    expect(normalizeChipKey('SPEC_INCOMPLETE')).toBe('SPEC_INCOMPLETE');
  });

  it('uses statuses i18n when the key exists', () => {
    expect(humanizeOrderChip('en', 'IN_PRODUCTION')).toBe('In production');
    expect(humanizeOrderChip('en', 'Spec incomplete')).toBe('Needs specs');
    expect(humanizeOrderChip('ar', 'SPEC_INCOMPLETE')).toBe('المواصفات ناقصة');
  });

  it('title-cases unknown screaming enums instead of leaving SNAKE_CASE', () => {
    expect(humanizeOrderChip('en', 'FLOOR_HOLD')).toBe('Floor Hold');
  });

  it('passes through already-human stage names', () => {
    expect(humanizeOrderChip('en', 'Painting')).toBe('Painting');
  });

  it('treats equivalent leftover spellings as the same chip', () => {
    expect(chipsLookLikeSameLabel('Spec incomplete', 'SPEC_INCOMPLETE')).toBe(
      true,
    );
    expect(chipsLookLikeSameLabel('Preparing', 'IN_PRODUCTION')).toBe(false);
  });
});
