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

describe('Spec option picker floor', () => {
  const files = [
    'components/SpecOptionPickerSheet.tsx',
    'components/SpecFloorRow.tsx',
    'components/VariantSpecsBoard.tsx',
    'components/VariantSpecEditSheet.tsx',
    'components/SpecOptionChips.tsx',
    'components/DealerOrderSpecsBoard.tsx',
    'components/DealerAddSpecSheet.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(
        /DealerBoard|orderBoardShadow|AnimatedPressable|BottomSheet|CatalogSectionBoard/,
      );
    }
  });

  it('picker is backed by SpecOptionValue and hides inactive rows', () => {
    const picker = read('components/SpecOptionPickerSheet.tsx');
    expect(picker).toContain('selectSpecOptionValuesForPicker');
    expect(picker).toContain('localizedName');
    expect(picker).toContain('SpecOptionValue');
    expect(picker).not.toMatch(/catch-all|free.?text box/i);
  });

  it('variant ledger is a named ticket list, not chips', () => {
    const board = read('components/VariantSpecsBoard.tsx');
    expect(board).toContain('SpecFloorRow');
    expect(board).toContain('VariantSpecEditSheet');
    expect(board).toContain('compose');
    expect(board).not.toContain('SpecOptionChips');
  });
});
