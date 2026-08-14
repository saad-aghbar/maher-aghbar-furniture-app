import { tabLayoutKey } from '../tabConfig';

describe('tabLayoutKey', () => {
  it('is stable for the same permission snapshot regardless of order', () => {
    expect(tabLayoutKey('admin', ['inventory.transfer', 'inventory.read'])).toBe(
      tabLayoutKey('admin', ['inventory.read', 'inventory.transfer']),
    );
  });

  it('changes when permissions change', () => {
    expect(tabLayoutKey('admin', ['inventory.read'])).not.toBe(
      tabLayoutKey('admin', ['inventory.read', 'inventory.transfer']),
    );
  });
});
