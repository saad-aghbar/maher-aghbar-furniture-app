import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, '../PurchaseOrderBuilderScreen.tsx'), 'utf8');
const sheet = readFileSync(join(__dirname, '../components/AddMaterialSheet.tsx'), 'utf8');
const group = readFileSync(join(__dirname, '../components/SupplierGroupBoard.tsx'), 'utf8');
const board = readFileSync(join(__dirname, '../components/PurchasingFloorBoard.tsx'), 'utf8');

describe('order builder floor', () => {
  it('uses floor boards, RTL rows, and a full pill CTA', () => {
    expect(src).toContain('PurchasingFloorBoard');
    expect(src).toContain('orderBoardShadow');
    expect(src).toContain("isRTL ? 'row-reverse' : 'row'");
    expect(src).toContain('theme.sizes.touch.min');
    expect(src).toContain('radius.full');
    expect(sheet).toContain('QtyStepperField');
    expect(src).toContain('DatePickerField');
    expect(src).not.toContain('DeskCard');
    expect(src).not.toContain('SurfaceCard');
    expect(src).not.toContain('colors.info');
  });

  it('uses header-band accordions, search chrome, and inset money', () => {
    expect(src).toContain('SearchBarShell');
    expect(src).toContain('PURCHASING_CHROME_CONTROL_H');
    expect(src).toContain('onHeaderPress');
    expect(src).toContain('hideBody');
    expect(src).toContain('DealerEmptyPanel');
    expect(src).toContain('surfaceSecondary');
    expect(src).not.toContain('hideSection');
    expect(src).not.toContain('showSection');
    expect(board).toContain('headerAccent');
    expect(group).toContain('radius.lg');
    expect(group).toContain('surfaceSecondary');
    expect(group).toContain('onLinePress');
    expect(group).not.toContain('Destination:');
  });

  it('picks a supplier inline on the add-material sheet', () => {
    expect(sheet).toContain('SupplierPickList');
    expect(sheet).not.toContain('PurchasingSupplierSheet');
    expect(sheet).toContain("t('common.back')");
    expect(sheet).toContain("t('mobile.purchasing.cancel')");
    expect(sheet).toContain("t('mobile.purchasing.nextStep')");
    expect(sheet).toContain('fitContent');
    expect(sheet).toContain('unitCostFromInventory');
    expect(sheet).not.toContain('onChangeText={setUnitCost}');
  });

  it('holding locations are name-only floor rows', () => {
    expect(sheet).toContain('HoldingLocationPickList');
    expect(sheet).not.toContain('loc.warehouseName');
  });

  it('seeds the draft from itemIds and opens the add-material sheet for one item', () => {
    expect(src).toContain('parseBuilderSeedIds');
    expect(src).toContain('seedBuilderLines');
    expect(src).toContain('toBuilderMaterial');
    expect(src).toContain('getInventoryItem');
    expect(src).toContain('builderSeedAdded');
    expect(src).toContain('setAdding(seedMaterials[0]');
  });
});
