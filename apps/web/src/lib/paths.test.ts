import { describe, expect, it } from 'vitest';
import { isAuthPath, surfaceFromPath } from './paths';

describe('surface paths', () => {
  it('classifies auth routes', () => {
    expect(isAuthPath('/login')).toBe(true);
    expect(isAuthPath('/forgot-password')).toBe(true);
    expect(isAuthPath('/admin/dashboard')).toBe(false);
  });

  it('classifies surface segments', () => {
    expect(surfaceFromPath('/admin/orders')).toBe('admin');
    expect(surfaceFromPath('/dealer/catalog')).toBe('dealer');
    expect(surfaceFromPath('/worker/tasks')).toBe('worker');
    expect(surfaceFromPath('/login')).toBe(null);
  });
});
