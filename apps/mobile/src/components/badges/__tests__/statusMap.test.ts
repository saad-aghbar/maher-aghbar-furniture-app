import { lightTheme } from '@/theme';
import {
  brandedPillChrome,
  englishStatusFallback,
  getBadgeContainerStyle,
  getBadgeLabelStyle,
  resolvePriorityVariant,
  resolveStatusVariant,
} from '../badgeStyles';

describe('badge status / priority maps', () => {
  it('maps known statuses', () => {
    expect(resolveStatusVariant('APPROVED')).toBe('success');
    expect(resolveStatusVariant('PENDING')).toBe('warning');
    expect(resolveStatusVariant('OVERDUE')).toBe('error');
    expect(resolveStatusVariant('LATE')).toBe('warning');
    expect(resolveStatusVariant('QUOTED')).toBe('brand');
    expect(resolveStatusVariant('OPEN')).toBe('brand');
    expect(resolveStatusVariant('ISSUED')).toBe('brand');
    expect(resolveStatusVariant('IN_PROGRESS')).toBe('brand');
    expect(resolveStatusVariant('UNKNOWN_XYZ')).toBe('default');
  });

  it('maps priorities', () => {
    expect(resolvePriorityVariant('low')).toBe('default');
    expect(resolvePriorityVariant('medium')).toBe('brand');
    expect(resolveStatusVariant('IN_PRODUCTION')).toBe('brand');
    expect(resolveStatusVariant('DELIVERED')).toBe('success');
    expect(resolvePriorityVariant('high')).toBe('warning');
    expect(resolvePriorityVariant('urgent')).toBe('error');
  });

  it('formats english fallback labels', () => {
    expect(englishStatusFallback('IN_PROGRESS')).toBe('In Progress');
  });

  it('uses theme soft fills without throwing', () => {
    expect(lightTheme.colors.successSoft).toBeTruthy();
    expect(lightTheme.colors.errorSoft).toBeTruthy();
  });

  it('flips badge chrome in RTL and keeps shrink room for Arabic', () => {
    const ltr = getBadgeContainerStyle(lightTheme, 'warning');
    const rtl = getBadgeContainerStyle(lightTheme, 'warning', { isRTL: true });
    expect(ltr.flexDirection).toBe('row');
    expect(ltr.alignSelf).toBe('flex-start');
    expect(rtl.flexDirection).toBe('row-reverse');
    expect(rtl.alignSelf).toBe('flex-end');
    expect(rtl.maxWidth).toBe('100%');
    expect(rtl.flexShrink).toBe(1);
  });

  it('brand wash is wood, not mint success', () => {
    const wood = getBadgeContainerStyle(lightTheme, 'brand');
    const mint = getBadgeContainerStyle(lightTheme, 'success');
    expect(wood.backgroundColor).toBe(lightTheme.colors.brandSoft);
    expect(mint.backgroundColor).toBe(lightTheme.colors.successSoft);
    expect(wood.backgroundColor).not.toBe(mint.backgroundColor);
  });

  it('branded chrome is cream + Army Camo + Liquorice on parchment', () => {
    const chrome = brandedPillChrome(lightTheme);
    expect(chrome.backgroundColor).toBe(lightTheme.colors.brandSoft);
    expect(chrome.borderColor).toBe(lightTheme.colors.brand);
    expect(chrome.color).toBe(lightTheme.colors.textPrimary);
    expect(chrome.borderColor).toBe('#776245');
    expect(chrome.color).toBe('#1E1A1B');

    const box = getBadgeContainerStyle(lightTheme, 'default', { branded: true });
    expect(box.backgroundColor).toBe(chrome.backgroundColor);
    expect(box.borderColor).toBe(chrome.borderColor);

    const label = getBadgeLabelStyle(lightTheme, 'default', true);
    expect(label.color).toBe(chrome.color);

    const quiet = getBadgeContainerStyle(lightTheme, 'default');
    expect(quiet.borderColor).toBe(lightTheme.colors.border);
  });
});
