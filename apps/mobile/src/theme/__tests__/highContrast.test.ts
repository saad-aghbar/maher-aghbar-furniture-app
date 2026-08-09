import { applyHighContrast } from '../highContrast';
import { lightColors } from '../colors';

describe('highContrast', () => {
  it('darkens light text/borders for accessibility', () => {
    const next = applyHighContrast(lightColors, 'light');
    expect(next.textPrimary).toBe('#000000');
    expect(next.border).not.toBe(lightColors.border);
  });
});
