import { readFileSync } from 'fs';
import { join } from 'path';
import { binStockSummary, formatWarehouseQty } from '../warehouseDesk';

const inventoryDir = join(__dirname, '..');

describe('inventory warehouses desk', () => {
  it('lists warehouses as floor boards with an add-warehouse dock', () => {
    const src = readFileSync(join(inventoryDir, 'InventoryWarehousesScreen.tsx'), 'utf8');
    expect(src).toContain('InventoryBoardCard');
    expect(src).toContain('CreateWarehouseSheet');
    expect(src).toContain('FloatingActionDock');
    expect(src).toContain('DealerEmptyPanel');
    expect(src).toContain('newWarehouse');
    expect(src).toContain("can(user, 'warehouse.manage')");
    expect(src).not.toContain('DeskCard');
    expect(src).not.toContain('SurfaceCard');
  });

  it('opens bin contents, QR, and add/edit bins on the warehouse detail floor', () => {
    const src = readFileSync(join(inventoryDir, 'InventoryWarehouseDetailScreen.tsx'), 'utf8');
    expect(src).toContain('useWarehouseDeskQuery');
    expect(src).toContain('BinContentsSheet');
    expect(src).toContain('HoldingLocationFormSheet');
    expect(src).toContain("copy=\"bin\"");
    expect(src).toContain('InventoryIdentityBoard');
    expect(src).toContain('openWarehouseLocationQrLabelPdf');
    expect(src).toContain('queueBinPrint');
    expect(src).toContain('flushPendingBinPrint');
    expect(src).toContain('onClosed={flushPendingBinPrint}');
    expect(src).not.toContain('void printBin(inspectLoc)');
    expect(src).not.toContain('void printBin(qrLoc)');
    expect(src).toContain('deactivateBin');
    expect(src).not.toContain('DeskCard');
    expect(src).not.toContain('SurfaceCard');
  });

  it('hub Warehouses control navigates to the desk', () => {
    const home = readFileSync(join(inventoryDir, 'components/InventorySignatureHome.tsx'), 'utf8');
    expect(home).toContain('warehousesSection');
    expect(home).toContain('/(app)/(admin)/inventory/warehouses');
    expect(home).not.toContain('CreateWarehouseSheet');
  });

  it('summarizes stocked SKUs on a bin', () => {
    expect(binStockSummary([{ availableQty: 4 }, { availableQty: '1.5' }])).toEqual({
      skuCount: 2,
      qty: 5.5,
    });
    expect(formatWarehouseQty(4)).toBe('4');
    expect(formatWarehouseQty(1.5)).toBe('1.5');
  });
});
