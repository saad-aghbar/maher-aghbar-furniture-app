import { readFileSync } from 'fs';
import { join } from 'path';

const MOBILE_SRC = join(__dirname, '../..');

function read(rel: string): string {
  return readFileSync(join(MOBILE_SRC, rel), 'utf8');
}

describe('Wave 0 adaptive shell contracts', () => {
  it('TabSwipeNavigator keeps GestureDetector mounted and toggles the pan with enabled()', () => {
    const src = read('navigation/TabSwipeNavigator.tsx');
    expect(src).toContain('GestureDetector');
    expect(src).toContain('.enabled(enabled)');
    expect(src).toContain('isCompact && onRoot');
    expect(src).not.toMatch(/if\s*\(\s*!isCompact[\s\S]*return\s+children/);
  });

  it('proof overlays host AdaptiveOverlay with an intent', () => {
    const files = [
      'components/sheets/ConfirmationSheet.tsx',
      'features/sales-orders/components/OrdersFilterSheet.tsx',
      'features/scheduling/components/WorkerDaySheet.tsx',
      'features/scheduling/components/StageDaySheet.tsx',
    ];
    for (const rel of files) {
      const src = read(rel);
      expect(src).toContain('<AdaptiveOverlay');
      expect(src).toMatch(/intent="/);
      expect(src).not.toMatch(/<BottomSheet[\s>]/);
    }
  });

  it('inventory identify keeps runIdentifyScan and does not mount a desk scan dock', () => {
    const src = read('features/inventory/components/InventorySignatureHome.tsx');
    expect(src).toContain('async function runIdentifyScan');
    expect(src).toContain('async function dispatchIdentifyCode');
    expect(src).toContain('await dispatchIdentifyCode(code)');
    expect(src).toContain('resolveInventoryScan');
    expect(src).not.toContain('mobile.adaptive.scanDockLabel');
    expect(src).not.toContain('useMaherLayout');
  });

  it('admin orders tab mounts the desk host rather than pushing the list alone', () => {
    const route = readFileSync(
      join(__dirname, '../../../app/(app)/(admin)/(tabs)/orders.tsx'),
      'utf8',
    );
    expect(route).toContain('OrdersDeskHost');
    expect(read('features/sales-orders/OrdersDeskHost.tsx')).toContain('setParams({ selected:');
    expect(read('features/sales-orders/OrdersDeskHost.tsx')).toContain('embedded');
  });

  it('purchasing hub mounts the desk host with embedded PO detail', () => {
    const route = readFileSync(
      join(__dirname, '../../../app/(app)/(admin)/purchasing/index.tsx'),
      'utf8',
    );
    expect(route).toContain('PurchasingDeskHost');
    expect(read('features/purchasing/PurchasingDeskHost.tsx')).toContain('embedded');
    expect(read('features/purchasing/PurchasingDeskHost.tsx')).toContain('selectOrPush');
  });

  it('inventory hub host embeds InventoryItemDetailScreen on selected', () => {
    const src = read('features/inventory/InventoryHubHost.tsx');
    expect(src).toContain('InventoryItemDetailScreen');
    expect(src).toContain('embedded');
    expect(src).toContain('setParams({ selected:');
  });
});
