import { describe, expect, it } from 'vitest';
import { inventoryDeepLink } from './inventory-deep-link';

describe('inventoryDeepLink', () => {
  it('opens a material category inside materials', () => {
    expect(inventoryDeepLink('foam')).toEqual({ lifecycle: 'materials', categoryGroup: 'foam' });
  });

  it('opens finished and semi landmarks', () => {
    expect(inventoryDeepLink('finished')).toEqual({ lifecycle: 'finished' });
    expect(inventoryDeepLink('semi-finished')).toEqual({ lifecycle: 'semiFinished' });
  });

  it('rejects an unknown group', () => {
    expect(inventoryDeepLink('mystery')).toBeNull();
  });
});
