import { formatInventoryMaterialType, isValidCategoryGroup } from '../selectInventory';

describe('formatInventoryMaterialType', () => {
  const t = (key: string) =>
    key === 'mobile.inventory.groups.fabric' ? 'Fabric' : key;

  it('translates known group keys', () => {
    expect(formatInventoryMaterialType('fabric', t)).toBe('Fabric');
    expect(isValidCategoryGroup('foam')).toBe(true);
  });

  it('keeps custom subtype labels', () => {
    expect(formatInventoryMaterialType('Linen', t)).toBe('Linen');
  });
});
