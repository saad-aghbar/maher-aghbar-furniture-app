import { readFileSync } from 'fs';
import { join } from 'path';

const screen = readFileSync(join(__dirname, '../InventoryLowStockScreen.tsx'), 'utf8');
const row = readFileSync(join(__dirname, '../components/InventoryLowStockPickRow.tsx'), 'utf8');

describe('inventory low-stock floor', () => {
  it('uses the category rail, pick cards, and a dock CTA', () => {
    expect(screen).toContain('InventoryCategoryRail');
    expect(screen).toContain('InventoryLowStockPickRow');
    expect(screen).toContain('DealerEmptyPanel');
    expect(screen).toContain('FloatingActionDock');
    expect(screen).toContain('createPurchaseOrderCount');
    expect(screen).toContain('lowStockBuilderHref');
    expect(screen).not.toContain('DeskCard');
    expect(screen).not.toContain('SurfaceCard');
  });

  it('keeps the warning board recipe on each pick row', () => {
    expect(row).toContain('orderBoardShadow');
    expect(row).toContain('StatusBadge');
    expect(row).toContain('lowStockShortBy');
    expect(row).toContain('common.details');
    expect(row).toContain('opacity: 0.9');
    expect(row).not.toContain('DeskCard');
    expect(row).not.toContain('SurfaceCard');
  });
});
