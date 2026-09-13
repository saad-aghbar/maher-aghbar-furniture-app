import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../..');

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

const FORBIDDEN_LABELS = [
  "t('catalog.nameEn')",
  "t('catalog.nameAr')",
  "t('catalog.nameHe')",
  "t('catalog.measurementNameEn')",
  "t('catalog.measurementNameAr')",
  "t('catalog.factoryNotesAr')",
  "t('catalog.factoryNotesEn')",
  "t('users.nameEn')",
  "t('users.nameAr')",
  "t('users.nameHe')",
  "t('users.descriptionEn')",
  "t('users.descriptionAr')",
  "t('users.descriptionHe')",
  "t('mobile.inventory.nameEn')",
  "t('mobile.inventory.nameAr')",
  "t('mobile.production.workflow.nameEn')",
  "t('mobile.production.workflow.nameAr')",
  "t('mobile.production.workflow.nameHe')",
  "t('production.setup.outputNameEn')",
  "t('production.setup.outputNameAr')",
  "t('production.setup.outputNameHe')",
  "t('production.setup.pieceNameEn')",
  "t('production.setup.pieceNameAr')",
  "t('production.setup.pieceNameHe')",
];

const FORMS = [
  'features/catalog/components/CreateProductSheet.tsx',
  'features/catalog/components/CreateVariantSheet.tsx',
  'features/catalog/AdminProductDetailScreen.tsx',
  'features/catalog/AdminVariantDetailScreen.tsx',
  'features/catalog/components/CategoryPickerSheet.tsx',
  'features/catalog/components/VariantSpecEditSheet.tsx',
  'features/dealers/components/CreateDealerSheet.tsx',
  'features/dealers/components/EditDealerSheet.tsx',
  'features/purchasing/components/CreateSupplierSheet.tsx',
  'features/more/AdminSettingsScreen.tsx',
  'features/inventory/components/CreateInventoryItemSheet.tsx',
  'features/inventory/components/EditInventoryItemSheet.tsx',
  'features/inventory/components/CreateWarehouseSheet.tsx',
  'features/inventory/components/InventoryMeasurementsSection.tsx',
  'features/users/StaffTypeEditorScreen.tsx',
  'features/workflow/WorkflowListScreen.tsx',
  'features/workflow/components/AddStageSheet.tsx',
  'features/workflow/ManageStagesScreen.tsx',
  'features/workflow/components/ProductionStageSetupSheet.tsx',
  'features/sales-orders/production-setup/OrderProductionSetupLineScreen.tsx',
];

describe('single-language name fields', () => {
  it('uses LocaleNameField instead of EN/AR/HE inputs', () => {
    for (const file of FORMS) {
      const src = read(file);
      expect(src).toContain('LocaleNameField');
      expect(src).not.toMatch(/<BilingualNameField\b/);
      expect(src).not.toContain('nameFieldOrder');
      for (const token of FORBIDDEN_LABELS) {
        expect(src).not.toContain(token);
      }
    }
  });

  it('requires the visible name only on inventory and workflow create', () => {
    const createItem = read('features/inventory/components/CreateInventoryItemSheet.tsx');
    const warehouse = read('features/inventory/components/CreateWarehouseSheet.tsx');
    const workflow = read('features/workflow/WorkflowListScreen.tsx');
    const stages = read('features/workflow/ManageStagesScreen.tsx');
    expect(createItem).toContain("t('catalog.namesRequired')");
    expect(createItem).not.toContain("t('mobile.inventory.createItemRequired')");
    expect(warehouse).toContain('catalog.namesRequired');
    expect(warehouse).not.toContain('createWarehouseRequired');
    expect(workflow).toContain('!name.trim()');
    expect(workflow).not.toContain('names.nameHe.trim()');
    expect(stages).toContain('!draft.name.trim()');
  });
});
