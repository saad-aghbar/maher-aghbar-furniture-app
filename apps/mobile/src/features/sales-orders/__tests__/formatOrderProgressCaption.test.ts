import {
  formatOrderProgressCaption,
  formatOrderProgressPercent,
} from '../formatOrderProgressCaption';

describe('formatOrderProgressCaption', () => {
  it('joins stage label and percent with LTR-isolated digits', () => {
    expect(formatOrderProgressCaption(42.6, 'Carpentry')).toBe(
      'Carpentry · \u206643%\u2069',
    );
  });

  it('falls back to percent only', () => {
    expect(formatOrderProgressCaption(12, null)).toBe('\u206612%\u2069');
    expect(formatOrderProgressCaption(12, '  ')).toBe('\u206612%\u2069');
  });

  it('keeps percent token LTR-isolated', () => {
    expect(formatOrderProgressPercent(41)).toBe('\u206641%\u2069');
  });
});
