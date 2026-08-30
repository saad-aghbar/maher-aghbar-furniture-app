import { sectionHeaderCountText } from '../SectionHeader';

describe('sectionHeaderCountText', () => {
  it('shows backend zeros', () => {
    expect(sectionHeaderCountText(0)).toBe('0');
    expect(sectionHeaderCountText(12)).toBe('12');
  });

  it('prefers an explicit count label', () => {
    expect(sectionHeaderCountText(20, '20 orders')).toBe('20 orders');
  });

  it('omits trailing meta when neither count nor label is passed', () => {
    expect(sectionHeaderCountText()).toBeNull();
  });
});
