import {
  formatInventoryMaterialType,
  inventoryGroupRouteTitle,
  isValidCategoryGroup,
} from '../selectInventory';

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

describe('inventoryGroupRouteTitle', () => {
  const t = (key: string) => {
    if (key === 'mobile.inventory.groups.fabric') return 'Fabric';
    if (key === 'mobile.inventory.groupLandmark.finished') return 'Finished';
    if (key === 'mobile.inventory.groupLandmark.semi') return 'Semi';
    if (key === 'mobile.inventory.title') return 'Inventory';
    return key;
  };

  it('uses Finished / Semi landmarks from the route', () => {
    expect(inventoryGroupRouteTitle('finished', t)).toBe('Finished');
    expect(inventoryGroupRouteTitle('semi', t)).toBe('Semi');
    expect(inventoryGroupRouteTitle('semiFinished', t)).toBe('Semi');
  });

  it('uses the category name for raw groups', () => {
    expect(inventoryGroupRouteTitle('fabric', t)).toBe('Fabric');
  });
});
