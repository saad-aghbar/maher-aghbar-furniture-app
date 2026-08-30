import { readFileSync } from 'fs';
import { join } from 'path';

const inventoryDir = join(__dirname, '..');

describe('inventory scan identity (mobile)', () => {
  it('QR sheet encodes item.scanCode only and fits content height', () => {
    const src = readFileSync(join(inventoryDir, 'components/InventoryQrSheet.tsx'), 'utf8');
    expect(src).toContain('value={payload}');
    expect(src).toContain("item?.scanCode?.trim() || ''");
    expect(src).toContain('fitContent');
    expect(src).not.toContain('value={item.sku}');
    expect(src).not.toContain('qrCode || sku');
    expect(src).not.toContain('item.qrCode');
    expect(src).not.toContain('height * 0.78');
  });

  it('known-item receive uses label confirmation, not CodeField lookup swap', () => {
    const src = readFileSync(join(inventoryDir, 'components/AddStockSheet.tsx'), 'utf8');
    expect(src).toContain('knownItem');
    expect(src).toContain('KnownItemLabelConfirm');
    expect(src).toContain('allowChangeItem');
    expect(src).toContain('onUseScanned');
    // Known path must not drive CodeField confirm-optional lookup.
    expect(src).not.toContain('scanConfirmOptional');
    const submit = src.slice(src.indexOf('function submit()'), src.indexOf('const title'));
    expect(submit).not.toContain('lookupCode');
    expect(submit).toContain('if (!item)');
  });

  it('known-item label confirm is presentation-only; parent owns VERIFY', () => {
    const confirm = readFileSync(
      join(inventoryDir, 'components/KnownItemLabelConfirm.tsx'),
      'utf8',
    );
    const match = readFileSync(
      join(inventoryDir, 'components/InventoryScanMatchResult.tsx'),
      'utf8',
    );
    const pipeline = readFileSync(join(inventoryDir, 'runInventoryLabelVerify.ts'), 'utf8');
    const hook = readFileSync(join(inventoryDir, 'useLabelVerifyScan.ts'), 'utf8');
    expect(confirm).toContain('MODE C — VERIFY');
    expect(confirm).toContain('presentation only');
    expect(confirm).toContain('onScanPress');
    expect(confirm).not.toContain('useCodeScanner');
    expect(confirm).not.toMatch(/openScanner\s*\(/);
    expect(confirm).not.toContain('resolveInventoryScan');
    expect(pipeline).toContain('classifyLabelScan');
    expect(pipeline).toContain('resolveInventoryScan');
    expect(hook).toContain('openScanner');
    expect(hook).toContain('runInventoryLabelVerify');
    expect(match).toContain('MATCH');
    expect(match).toContain('MISMATCH');
    expect(match).toContain('onUseScanned');
    expect(match).toContain('keepSelectedMaterial');
    // Inline result — no BottomSheet Modal for match UI.
    expect(confirm).not.toContain('BottomSheet');
    expect(match).not.toContain('BottomSheet');
  });

  it('Receive/Issue/Transfer/Count sheets own VERIFY via useLabelVerifyScan', () => {
    for (const name of [
      'components/AddStockSheet.tsx',
      'components/CreateTransferSheet.tsx',
      'components/CreateStockCountSheet.tsx',
    ]) {
      const src = readFileSync(join(inventoryDir, name), 'utf8');
      expect(src).toContain('useLabelVerifyScan');
      expect(src).toContain('runLabelVerify');
      expect(src).toContain('onScanPress');
      expect(src).toContain('resultKind={verifyKind}');
      expect(src).not.toMatch(/key=\{`\$\{open \? 'open'/);
    }
  });

  it('create and edit do not scan or send qrCode; barcode scan is supplier-only', () => {
    const create = readFileSync(
      join(inventoryDir, 'components/CreateInventoryItemSheet.tsx'),
      'utf8',
    );
    const edit = readFileSync(join(inventoryDir, 'components/EditInventoryItemSheet.tsx'), 'utf8');
    const types = readFileSync(join(__dirname, '../../../api/modules/inventory.ts'), 'utf8');
    const createInput = types.slice(
      types.indexOf('export type CreateInventoryItemInput'),
      types.indexOf('export type UpdateInventoryItemInput'),
    );
    expect(createInput).toContain('barcode?: string');
    expect(createInput).not.toContain('qrCode');
    for (const src of [create, edit]) {
      expect(src).toContain('supplierBarcode');
      expect(src).toContain('scanSupplierBarcode');
      expect(src).toContain('barcode.trim()');
      expect(src).toContain('scanIcon="barcode-outline"');
      expect(src).not.toContain("t('mobile.inventory.scan')");
      expect(src).not.toContain("t('mobile.inventory.qrCode')");
      expect(src).not.toContain("t('mobile.scan.enterOrScan')");
    }
    const submit = create.slice(create.indexOf('function submit()'), create.indexOf('return ('));
    expect(submit).toContain('barcode:');
    expect(submit).not.toContain('qrCode');
  });

  it('create success offers View QR after the create Modal unmounts, and does not auto-open it', () => {
    const home = readFileSync(join(inventoryDir, 'components/InventorySignatureHome.tsx'), 'utf8');
    const createBlock = home.slice(
      home.indexOf('<CreateInventoryItemSheet'),
      home.indexOf('<EditInventoryItemSheet'),
    );
    expect(createBlock).toContain('onClosed={openCreateSuccessIfNeeded}');
    expect(createBlock).not.toContain('queueQrAfterSheet');
    expect(createBlock).not.toContain('setQrItem(');
    expect(home).toContain('createSuccessOpen');
    expect(home).toContain("t('mobile.inventory.viewQr')");
    expect(home).toContain("t('mobile.inventory.printLabel')");
    expect(home).toContain("t('mobile.inventory.viewDetails')");
  });

  it('Print label from QR sheet waits until the QR Modal closes', () => {
    const home = readFileSync(join(inventoryDir, 'components/InventorySignatureHome.tsx'), 'utf8');
    const qr = readFileSync(join(inventoryDir, 'components/InventoryQrSheet.tsx'), 'utf8');
    expect(qr).toContain('onClosed');
    expect(home).toContain('printLabelAfterQrCloses');
    expect(home).toContain('onClosed={flushPendingPrint}');
    expect(home).toContain('pendingPrintRef');
    expect(home).toContain('openInventoryQrLabelPdf');
    expect(home).toContain('openInventoryLabelPdf');
  });

  it('scan result actions queue via pendingAfterScan and flush only on onClosed', () => {
    const home = readFileSync(join(inventoryDir, 'components/InventorySignatureHome.tsx'), 'utf8');
    expect(home).toContain('pendingAfterScanRef');
    expect(home).toContain('queueAfterScan');
    expect(home).toContain('flushAfterScanClosed');
    expect(home).toContain('onClosed={flushAfterScanClosed}');
    expect(home).toContain("queueAfterScan({ type: 'receive'");
    expect(home).toContain("queueAfterScan({ type: 'issue'");
    expect(home).toContain("queueAfterScan({ type: 'transfer'");
    expect(home).toContain("queueAfterScan({ type: 'count'");
    expect(home).toContain("queueAfterScan({ type: 'details'");
    expect(home).toContain("queueAfterScan({ type: 'qr'");
    expect(home).toContain("queueAfterScan({ type: 'scanAgain'");
    // Must not open next Modal in the same tick as dismiss.
    expect(home).not.toMatch(/setScanResult\(null\);\s*\n\s*setMove\(/);
    expect(home).not.toMatch(/setScanResult\(null\);\s*\n\s*setOpsItem\(/);
    expect(home).not.toMatch(/setScanResult\(null\);\s*\n\s*router\.push/);
  });

  it('warehouse pickers offer Scan QR confirm selection without auto-submit', () => {
    const pick = readFileSync(join(inventoryDir, 'components/InventoryItemPickPanel.tsx'), 'utf8');
    const transfer = readFileSync(join(inventoryDir, 'components/CreateTransferSheet.tsx'), 'utf8');
    const count = readFileSync(join(inventoryDir, 'components/CreateStockCountSheet.tsx'), 'utf8');
    const add = readFileSync(join(inventoryDir, 'components/AddStockSheet.tsx'), 'utf8');
    const select = readFileSync(
      join(inventoryDir, 'components/ScanInventoryItemAction.tsx'),
      'utf8',
    );
    expect(pick).toContain('onRequestScan');
    expect(pick).not.toContain('<ScanInventoryItemAction');
    expect(pick).not.toContain("from './ScanInventoryItemAction'");
    expect(transfer).toContain('ScanInventoryItemAction');
    expect(transfer).toContain('KnownItemLabelConfirm');
    expect(transfer).toContain('absoluteFillObject');
    expect(count).toContain('ScanInventoryItemAction');
    expect(count).toContain('KnownItemLabelConfirm');
    expect(add).toContain('ScanInventoryItemAction');
    expect(add).toContain('InventoryScanSelectInline');
    expect(select).toContain('InventoryScanSelectInline');
    expect(select).toContain('MODE B — SELECT');
    expect(select).not.toContain('ScannedInventoryItemConfirm');
  });

  it('global inventory Scan remains on chrome', () => {
    const chrome = readFileSync(
      join(inventoryDir, 'components/InventoryCompositionChrome.tsx'),
      'utf8',
    );
    expect(chrome).toContain('scanVisible');
    expect(chrome).toContain('qr-code-outline');
    expect(chrome).toContain('onScan');
  });

  it('admin create/edit forms omit qrCode and label barcode as supplier barcode', () => {
    const admin = readFileSync(
      join(
        __dirname,
        '../../../../../admin-web/src/app/[locale]/inventory/inventory-client.tsx',
      ),
      'utf8',
    );
    const createFn = admin.slice(
      admin.indexOf('const createItemMutation'),
      admin.indexOf('const syncMaterialsMutation'),
    );
    expect(createFn).toContain('barcode: itemBarcode.trim()');
    expect(createFn).not.toContain('qrCode');
    const updateFn = admin.slice(
      admin.indexOf('const updateItemMutation'),
      admin.indexOf('const orderMaterialsMutation'),
    );
    expect(updateFn).not.toContain('qrCode');
    expect(updateFn).not.toContain('sku:');
    expect(admin).toContain("ti('supplierBarcode')");
    expect(admin).not.toMatch(/ti\('qrCode'\)/);
  });
});
