import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, '../LowStockReviewScreen.tsx'), 'utf8');
const dest = readFileSync(join(__dirname, '../components/DestinationPickSheet.tsx'), 'utf8');

describe('low stock floor', () => {
  it('uses boards, a warning unassigned path, and empty state', () => {
    expect(src).toContain('PurchasingFloorBoard');
    expect(src).toContain('DealerEmptyPanel');
    expect(src).toContain('unassignedSupplierHint');
    expect(src).toContain('colors.warning');
    expect(src).not.toContain('DeskCard');
    expect(src).not.toContain('SurfaceCard');
  });

  it('locks edits until a material is added, then shows the chosen place', () => {
    expect(src).toContain('addToLowStockOrder');
    expect(src).toContain('addedToLowStockOrder');
    expect(src).toContain('lowStockPickHint');
    expect(src).toContain('ReceiveFloorTrigger');
    expect(src).toContain('caption={row.locationName}');
    expect(src).toContain('lowStockDestinationLabel');
    expect(src).toContain('headerAccent={selected}');
    expect(src).toContain('{selected ? (');
    expect(src).toContain('QtyStepperField');
    expect(src).toContain('seedLowStockExcluded(working)');
    expect(dest).toContain('PurchasingWarehousePickList');
    expect(dest).toContain('HoldingLocationPickList');
    expect(dest).toContain('holdingPlace');
    expect(dest).not.toContain("from '@/features/inventory/components/WarehousePickList'");
  });
});
