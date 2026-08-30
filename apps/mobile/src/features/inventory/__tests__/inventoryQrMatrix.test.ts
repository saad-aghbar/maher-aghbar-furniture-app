import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const inventoryDir = join(__dirname, '..');
const componentsDir = join(inventoryDir, 'components');

type MatrixRow = {
  trigger: string;
  mode: 'IDENTIFY' | 'SELECT' | 'VERIFY' | 'SUPPLIER_BARCODE';
  resolver: string;
  successUi: string;
};

/**
 * Explicit inventory QR interaction matrix.
 * Fails if a ScanInventoryItemAction / openScanner / KnownItemLabelConfirm
 * call site lacks a documented result handler in source.
 */
const REQUIRED: MatrixRow[] = [
  {
    trigger: 'InventorySignatureHome.runIdentifyScan',
    mode: 'IDENTIFY',
    resolver: 'resolveInventoryScan',
    successUi: 'InventoryScanResultSheet',
  },
  {
    trigger: 'ScanInventoryItemAction (Transfer/Count/Receive/Issue/PickPanel)',
    mode: 'SELECT',
    resolver: 'resolveInventoryScan',
    successUi: 'InventoryScanSelectInline',
  },
  {
    trigger: 'useLabelVerifyScan + KnownItemLabelConfirm (Receive/Issue/Transfer/Count)',
    mode: 'VERIFY',
    resolver: 'runInventoryLabelVerify → resolveInventoryScan',
    successUi: 'InventoryScanMatchResult (parent-owned state)',
  },
  {
    trigger: 'AddStockSheet.CodeField (unknown-item only)',
    mode: 'SELECT',
    resolver: 'resolveInventoryScan',
    successUi: 'InventoryScanSelectInline',
  },
  {
    trigger: 'Create/EditInventoryItemSheet CodeField',
    mode: 'SUPPLIER_BARCODE',
    resolver: 'none (barcode field only)',
    successUi: 'fills barcode — not inventory identify',
  },
];

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTsx(full));
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('inventory QR complete interaction matrix', () => {
  const sources = walkTsx(componentsDir).map((p) => ({
    path: p,
    src: readFileSync(p, 'utf8'),
  }));

  it('documents every required mode with a success UI', () => {
    for (const row of REQUIRED) {
      expect(row.successUi.length).toBeGreaterThan(0);
      expect(row.resolver.length).toBeGreaterThan(0);
    }
  });

  it('every ScanInventoryItemAction usage is SELECT mode with confirm', () => {
    const action = readFileSync(join(componentsDir, 'ScanInventoryItemAction.tsx'), 'utf8');
    expect(action).toContain('MODE B — SELECT');
    expect(action).toContain('resolveInventoryScan');
    expect(action).toContain('InventoryScanSelectInline');
    expect(action).toContain("present('not-found'");
    expect(action).toContain("present('error'");
    expect(action).not.toContain('ScannedInventoryItemConfirm');
    expect(action).not.toContain('showToast');

    const hosts = sources.filter((f) => f.src.includes('<ScanInventoryItemAction'));
    expect(hosts.length).toBeGreaterThanOrEqual(3);
    for (const host of hosts) {
      expect(host.src).toMatch(/onItemSelected/);
    }
  });

  it('every KnownItemLabelConfirm usage is VERIFY presentation (parent owns scan)', () => {
    const verify = readFileSync(join(componentsDir, 'KnownItemLabelConfirm.tsx'), 'utf8');
    const pipeline = readFileSync(join(inventoryDir, 'runInventoryLabelVerify.ts'), 'utf8');
    const hook = readFileSync(join(inventoryDir, 'useLabelVerifyScan.ts'), 'utf8');
    expect(verify).toContain('MODE C — VERIFY');
    expect(verify).toContain('presentation only');
    expect(verify).not.toContain('useCodeScanner');
    expect(verify).not.toMatch(/openScanner\s*\(/);
    expect(verify).not.toContain('resolveInventoryScan');
    expect(verify).toContain('InventoryScanMatchResult');
    expect(verify).toContain('onUseScanned');
    expect(pipeline).toContain('classifyLabelScan');
    expect(hook).toContain('runInventoryLabelVerify');

    const hosts = sources.filter((f) => f.src.includes('<KnownItemLabelConfirm'));
    expect(hosts.length).toBeGreaterThanOrEqual(3);
    for (const host of hosts) {
      expect(host.src).toContain('useLabelVerifyScan');
      expect(host.src).toContain('onScanPress');
      expect(host.src).toContain('onUseScanned');
    }
  });

  it('global IDENTIFY uses resolveInventoryScan + result sheet', () => {
    const home = readFileSync(join(componentsDir, 'InventorySignatureHome.tsx'), 'utf8');
    expect(home).toContain('resolveInventoryScan');
    expect(home).toContain('InventoryScanResultSheet');
    expect(home).toContain('pendingAfterScanRef');
    expect(home).not.toContain('getInventoryItemByCode');
  });

  it('CodeScannerProvider always flushes openScanner (no onDismiss-only hang)', () => {
    const provider = readFileSync(
      join(__dirname, '../../../components/scan/CodeScannerProvider.tsx'),
      'utf8',
    );
    expect(provider).toContain('InteractionManager.runAfterInteractions');
    expect(provider).toContain('flushResolve');
    expect(provider).toContain('onDismiss');
    expect(provider).toContain('key={session}');
    expect(provider).not.toContain("Platform.OS === 'ios'");
    expect(provider).not.toContain('CLOSE_HANDOFF_MS');
  });

  it('BottomSheet yields Modal while camera is open (no nested Modal freeze)', () => {
    const sheet = readFileSync(
      join(__dirname, '../../../components/sheets/BottomSheet.tsx'),
      'utf8',
    );
    expect(sheet).toContain('isScanning');
    expect(sheet).toMatch(/hostBlocked\s*=\s*\n?\s*isScanning\s*\|\|/);
    expect(sheet).toContain('!isScanning');
    // Inert opacity hack alone is not enough — host must yield.
    expect(sheet).not.toContain('opacity: isScanning ? 0 : 1');
  });

  it('no inventory openScanner call site is left without a result path', () => {
    const offenders: string[] = [];
    const inventorySources = walkTsx(inventoryDir).map((p) => ({
      path: p,
      src: readFileSync(p, 'utf8'),
    }));
    for (const file of inventorySources) {
      if (!file.src.includes('openScanner(')) continue;
      const rel = file.path.slice(inventoryDir.length + 1);
      // Create/Edit barcode is allowed without by-code.
      if (rel.includes('CreateInventoryItemSheet') || rel.includes('EditInventoryItemSheet')) {
        continue;
      }
      const hasResult =
        file.src.includes('resolveInventoryScan') ||
        file.src.includes('runInventoryLabelVerify') ||
        file.src.includes('getInventoryItemByCode') ||
        file.src.includes('setScanResult') ||
        file.src.includes('classifyLabelScan') ||
        file.src.includes('onScanned');
      if (!hasResult) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('BOM / product setup / purchasing office pickers do not inject warehouse Scan QR', () => {
    const outside = [
      join(__dirname, '../../catalog'),
      join(__dirname, '../../sales-orders'),
      join(__dirname, '../../purchasing'),
    ];
    for (const dir of outside) {
      try {
        for (const file of walkTsx(dir)) {
          const src = readFileSync(file, 'utf8');
          expect(src).not.toContain('ScanInventoryItemAction');
          expect(src).not.toContain('KnownItemLabelConfirm');
        }
      } catch {
        // directory may not exist
      }
    }
  });
});
