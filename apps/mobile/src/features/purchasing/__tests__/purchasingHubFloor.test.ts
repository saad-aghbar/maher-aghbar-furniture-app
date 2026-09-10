import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '..');

function read(rel: string) {
  return readFileSync(join(dir, rel), 'utf8');
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
}

describe('purchasing hub floor', () => {
  it('uses three hero tiles and no requests tab', () => {
    const hero = read('components/PurchasingHeroActions.tsx');
    const hub = read('PurchasingHubScreen.tsx');
    const tabs = read('components/PurchasingTabBar.tsx');
    expect(hero).toContain('catalog.newPurchaseOrder');
    expect(hero).toContain('catalog.fromLowStock');
    expect(hero).toContain('mobile.purchasing.suppliers');
    expect(hero).toContain('minHeight: 72');
    expect(hub).not.toContain("key: 'requests'");
    expect(tabs).not.toContain('requests:');
    expect(hub).toContain('orderBoardShadow');
    expect(hero).toContain('AnimatedPressable');
    expect(hub).toContain('PurchasingBuyAlertCard');
    expect(hub).toContain('warehouseId');
    expect(hub).toContain('ListItemEnter');
    expect(hub).toContain('theme.sizes.touch.min');
    expect(hub).toContain("locale === 'ar' ? 'medium'");
    expect(hub).not.toContain('stage spine');
    assertFloor(hero);
    assertFloor(hub);
    assertFloor(tabs);
  });

  it('lists every warehouse as floor rows in the filter sheet', () => {
    const sheet = read('components/PurchasingStatusFilterSheet.tsx');
    const list = read('components/PurchasingWarehousePickList.tsx');
    expect(sheet).toContain('PurchasingWarehousePickList');
    expect(list).toContain('orderBoardShadow');
    expect(list).toContain('theme.sizes.touch.min');
    expect(list).toContain('cube-outline');
    expect(list).toContain("locale === 'ar' ? 'medium'");
    assertFloor(sheet);
    assertFloor(list);
  });
});
