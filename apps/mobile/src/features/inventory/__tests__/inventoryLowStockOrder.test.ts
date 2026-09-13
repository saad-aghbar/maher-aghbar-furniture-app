import { readFileSync } from 'fs';
import { join } from 'path';

const detail = readFileSync(join(__dirname, '../InventoryItemDetailScreen.tsx'), 'utf8');
const home = readFileSync(join(__dirname, '../components/InventorySignatureHome.tsx'), 'utf8');
const focus = readFileSync(join(__dirname, '../components/InventoryLowStockFocus.tsx'), 'utf8');

describe('inventory low-stock purchase order', () => {
  it('opens the order builder from item detail, not the purchasing low-stock section', () => {
    expect(detail).toContain('createPurchaseOrder');
    expect(detail).toContain('purchasing/new?itemIds=');
    expect(detail).not.toContain('purchasing/low-stock');
    expect(detail).toContain('const showOrderDock = canOrder');
    expect(detail).toContain('dockBody');
    expect(detail).toContain('onCreatePo=');
    expect(detail).toContain('onReceive=');
    expect(detail).not.toContain('PrimaryButton');
  });

  it('reviews low stock on a dedicated inventory page', () => {
    expect(home).toContain('inventory/low-stock?group=');
    expect(home).not.toContain('onOrder=');
    expect(focus).not.toContain('onOrder');
    expect(focus).not.toContain('createPurchaseOrder');
  });
});
