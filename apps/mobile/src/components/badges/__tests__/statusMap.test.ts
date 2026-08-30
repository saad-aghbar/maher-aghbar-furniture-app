import { lightTheme } from '@/theme';
import {
  englishStatusFallback,
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
});
