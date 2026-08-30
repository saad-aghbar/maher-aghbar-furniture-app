import { flexDirectionFor, textAlignFor } from '@/i18n/rtl';

describe('ListRow RTL chrome', () => {
  it('flips row direction and text alignment', () => {
    expect(flexDirectionFor('rtl')).toBe('row-reverse');
    expect(flexDirectionFor('ltr')).toBe('row');
    expect(textAlignFor('rtl')).toBe('right');
    expect(textAlignFor('ltr')).toBe('left');
  });

  it('uses the start-edge chevron name in RTL', () => {
    const chevron = (isRTL: boolean) => (isRTL ? 'chevron-back' : 'chevron-forward');
    expect(chevron(false)).toBe('chevron-forward');
    expect(chevron(true)).toBe('chevron-back');
  });
});
