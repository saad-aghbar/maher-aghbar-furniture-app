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
    'CostOrderDossierScreen.tsx',
    'CostReturnDossierScreen.tsx',
    'components/CostFilterSheet.tsx',
    'components/CostPressableRow.tsx',
    'components/CostNotConfiguredSlot.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(/DealerBoard|CostPressableRow|CostNotConfiguredSlot/);
    }
  });

  it('makes list rows drillable via CostPressableRow', () => {
    const screen = read('ReportsScreen.tsx');
    expect(screen).toContain('CostPressableRow');
    expect(screen).toContain('router.push');
    expect(screen).toContain('mobile.reports.laborRates');
    const dossier = read('CostOrderDossierScreen.tsx');
    expect(dossier).toContain('mobile.reports.materials');
    expect(dossier).toContain('CostPressableRow');
  });
});

describe('Cost & Performance drillability sweep', () => {
  it('uses CostPressableRow for order, product, return, and coverage lists', () => {
    const screen = read('ReportsScreen.tsx');
    expect(screen).toContain('costOrdersQuery.data?.data ?? []).map');
    expect(screen).toContain('CostPressableRow');
    expect(screen).toContain('/(app)/(admin)/reports/order/');
    expect(screen).toContain('/(app)/(admin)/reports/returns/');
    expect(screen).toContain('/(app)/(admin)/inventory/items/');
    const dossier = read('CostOrderDossierScreen.tsx');
    expect(dossier).toContain('materials');
    expect(dossier).toContain('CostPressableRow');
    const ret = read('CostReturnDossierScreen.tsx');
    expect(ret).toContain('pieces');
    expect(ret).toContain('CostPressableRow');
  });
});
