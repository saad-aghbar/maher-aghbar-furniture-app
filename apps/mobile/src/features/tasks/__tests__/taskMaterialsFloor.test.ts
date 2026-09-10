import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '../components/TaskMaterialsFloorSection.tsx'),
  'utf8',
);

describe('TaskMaterialsFloorSection extra-material picker', () => {
  it('opens the category-bar material picker with search and QR', () => {
    expect(src).toContain('BomMaterialPickerSheet');
    expect(src).toContain('onRequestScan');
    expect(src).toContain('onPickExisting');
    expect(src).toContain('existingSkus={lines.map((line) => line.sku)}');
    expect(src).toContain("t('mobile.tasks.addMaterialHint')");
    expect(src).toContain("t('mobile.tasks.materialAlreadyOnStage')");
    expect(src).toContain('hideCost');
    expect(src).not.toContain('<TextField');
  });

  it('identifies a scanned code against the stage list', () => {
    expect(src).toContain('identifyTaskMaterial');
    expect(src).toContain("result.status === 'MATCH'");
    expect(src).toContain("result.status === 'EXTRA'");
    expect(src).toContain('selectExistingMaterial');
    expect(src).toContain('suggestedWarehouseId');
  });

  it('lets the worker tap the material and choose a warehouse on the row', () => {
    expect(src).toContain('toggleSelect(line.inventoryItemId)');
    expect(src).toContain('renderWarehousePicker(line, \'issue\')');
    expect(src).toContain('warehousesForLine');
    expect(src).toContain('materialWarehouseUnavailable');
    expect(src).not.toContain('radio-button-on');
  });
});
