import { attentionChrome, searchTrackColor, sheetChrome, tabBarChrome } from '../chrome';
import { darkColors, lightColors } from '../colors';

describe('chrome tokens', () => {
  it('maps attention cards onto charcoal + gold-tan', () => {
    const light = attentionChrome(lightColors);
    expect(light.surface).toBe(lightColors.attention);
    expect(light.accent).toBe(lightColors.attentionAccent);
    expect(light.on).toBe(lightColors.attentionOn);
    expect(light.surface).not.toBe(lightColors.error);
  });

  it('keeps sheet rows on cream, not system white', () => {
    const sheet = sheetChrome(lightColors, 'light');
    expect(sheet.canvas).toBe(lightColors.background);
    expect(sheet.row).toBe(lightColors.surface);
    expect(searchTrackColor(lightColors, 'light')).toBe(lightColors.surface);
  });

  it('uses an opaque cream tab shell in light mode', () => {
    const tab = tabBarChrome('light');
    expect(tab.shellBg).toContain('0.92');
    expect(tab.bubbleFill).toBe('#FFFFFF');
    expect(tabBarChrome('dark').shellBg).not.toBe(tab.shellBg);
  });
});
