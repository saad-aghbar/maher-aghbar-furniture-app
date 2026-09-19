import { describe, expect, it } from 'vitest';
import { classifyWidth, navigationModeFor } from './use-web-layout';

describe('web layout breakpoints', () => {
  it('maps 600/900/1200 like mobile', () => {
    expect(classifyWidth(390)).toBe('COMPACT');
    expect(classifyWidth(834)).toBe('MEDIUM');
    expect(classifyWidth(1024)).toBe('EXPANDED');
    expect(classifyWidth(1440)).toBe('WIDE');
  });

  it('keeps dealer and worker on a bottom bar', () => {
    expect(navigationModeFor('dealer', 'WIDE')).toBe('bottom');
    expect(navigationModeFor('worker', 'EXPANDED')).toBe('bottom');
    expect(navigationModeFor('admin', 'COMPACT')).toBe('bottom');
    expect(navigationModeFor('admin', 'MEDIUM')).toBe('rail');
    expect(navigationModeFor('admin', 'WIDE')).toBe('sidebar');
  });
});
