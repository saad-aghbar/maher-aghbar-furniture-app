import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '..');

function read(path: string) {
  return readFileSync(join(dir, path), 'utf8');
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
  expect(source).not.toContain("fontWeight: '700'");
}

describe('Cost & Performance floor', () => {
  const files = [
    'ReportsScreen.tsx',
    'ReportsMoneyScreen.tsx',
    'ReportsOrdersScreen.tsx',
    'CostOrderDossierScreen.tsx',
    'CostReturnDossierScreen.tsx',
    'ReportsInventoryScreen.tsx',
    'ReportsReturnsScreen.tsx',
    'ReportsCoverageScreen.tsx',
    'components/CostFilterSheet.tsx',
    'components/ReportsFilterBar.tsx',
    'components/CostPressableRow.tsx',
    'components/CostNotConfiguredSlot.tsx',
    'components/ReportsDeskRail.tsx',
    'components/ReportsPeriodChrome.tsx',
    'components/ReportsBasisTouchBar.tsx',
    'components/ReportsRangeSheet.tsx',
    'components/ReportsMoneyBoard.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
    }
    expect(read('components/CostFilterSheet.tsx')).not.toContain('RolesTouchBar');
    expect(read('components/ReportsFilterBar.tsx')).toContain('cost-filters-open');
    expect(read('components/CostFilterSheet.tsx')).toContain('nestedScrollEnabled');
  });

  it('makes list rows drillable via CostPressableRow', () => {
    const money = read('ReportsMoneyScreen.tsx');
    expect(money).toContain('CostPressableRow');
    expect(money).toContain('router.push');
    expect(money).toContain('mobile.reports.laborRates');
    const dossier = read('CostOrderDossierScreen.tsx');
    expect(dossier).toContain('mobile.reports.materials');
    expect(dossier).toContain('CostPressableRow');
  });
});

describe('Cost & Performance drillability sweep', () => {
  it('pads every Cost & Performance page so last boards clear the tab pill', () => {
    const pages = [
      'ReportsMoneyScreen.tsx',
      'ReportsOrdersScreen.tsx',
      'ReportsProductsScreen.tsx',
      'ReportsInventoryScreen.tsx',
      'ReportsReturnsScreen.tsx',
      'ReportsCoverageScreen.tsx',
      'ReportsFallbackScreen.tsx',
      'CostOrderDossierScreen.tsx',
      'CostReturnDossierScreen.tsx',
      'CostProductProfileScreen.tsx',
      'CostVariantProfileScreen.tsx',
      'CostInventoryItemScreen.tsx',
      'CostCoverageIssuesScreen.tsx',
      'CostCustomWorkScreen.tsx',
    ];
    for (const file of pages) {
      const source = read(file);
      expect(source).toContain('useCostFloorScrollPad');
      expect(source).toMatch(/style=\{\{\s*flex:\s*1\s*\}\}/);
      expect(source).not.toContain('paddingBottom: 32');
    }
    expect(read('components/ReportsRangeSheet.tsx')).toContain('ScrollView');
  });

  it('uses CostPressableRow for order, product, return, and coverage lists', () => {
    const orders = read('ReportsOrdersScreen.tsx');
    expect(orders).toContain('CostPressableRow');
    expect(orders).toContain('orderDossierHref');
    const products = read('ReportsProductsScreen.tsx');
    expect(products).toContain('CostPressableRow');
    const coverage = read('ReportsCoverageScreen.tsx');
    expect(coverage).toContain('coverageIssuesHref');
    const dossier = read('CostOrderDossierScreen.tsx');
    expect(dossier).toContain('materials');
    expect(dossier).toContain('CostPressableRow');
    const ret = read('CostReturnDossierScreen.tsx');
    expect(ret).toContain('pieces');
    expect(ret).toContain('CostPressableRow');
    expect(ret).toContain('recoveredNotNetted');
    const returnsDesk = read('ReportsReturnsScreen.tsx');
    expect(returnsDesk).toContain('recoveredNotNetted');
    const inventory = read('ReportsInventoryScreen.tsx');
    expect(inventory).toContain('inventoryItemHref');
    expect(inventory).toContain('automaticallyAdjustKeyboardInsets');
    expect(read('ReportsOrdersScreen.tsx')).toContain('automaticallyAdjustKeyboardInsets');
    expect(read('ReportsReturnsScreen.tsx')).toContain('automaticallyAdjustKeyboardInsets');
    expect(read('ReportsProductsScreen.tsx')).toContain('automaticallyAdjustKeyboardInsets');
  });
});
