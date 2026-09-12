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

describe('Product variant floor', () => {
  const files = [
    'AdminProductDetailScreen.tsx',
    'AdminVariantDetailScreen.tsx',
    'components/CreateProductSheet.tsx',
    'components/CreateVariantSheet.tsx',
    'components/VariantOptionGroupsBoard.tsx',
    'components/BilingualNameField.tsx',
    'components/CatalogSectionBoard.tsx',
    'components/CatalogBasketButton.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(/MoreBoard|orderBoardShadow|AnimatedPressable|BottomSheet/);
    }
  });

  it('has no catch-all spec text box', () => {
    const editor = read('AdminVariantDetailScreen.tsx');
    expect(editor).toContain('VariantOptionGroupsBoard');
    expect(editor).toContain('factoryNotesAr');
    expect(editor).not.toMatch(/catch-all|free.?text box/i);
  });

  it('owns measurements, seller prices, BOM, workflow and derived cost on the variant', () => {
    const editor = read('AdminVariantDetailScreen.tsx');
    expect(editor).toContain('copyVariantFromStandard');
    expect(editor).toContain('getVariantCost');
    expect(editor).toContain('mergeVariantDealerPrices');
    expect(editor).toContain('SellerPriceFloorRow');
    expect(editor).toContain('CatalogFloorEmpty');
    expect(editor).toContain('CappedNestedScroll');
    expect(editor).not.toContain('VariantCompositionBoard');
    expect(editor).not.toContain('VariantIncludedItemsBoard');
    expect(editor).not.toContain('VariantStageNotesBoard');
  });
});
