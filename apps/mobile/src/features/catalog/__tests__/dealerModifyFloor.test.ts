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

describe('Dealer modify variant floor', () => {
  const files = [
    'DealerModifyVariantScreen.tsx',
    'components/DealerOrderSpecsBoard.tsx',
    'components/DealerAddSpecSheet.tsx',
    'components/DealerMeasurementsBoard.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(
        /MoreBoard|orderBoardShadow|AnimatedPressable|BottomSheet|CatalogSectionBoard/,
      );
    }
  });

  it('does not create catalog library specs from the dealer desk', () => {
    const add = read('components/DealerAddSpecSheet.tsx');
    const board = read('components/DealerOrderSpecsBoard.tsx');
    const screen = read('DealerModifyVariantScreen.tsx');
    expect(add).not.toContain('createSpecOptionGroup');
    expect(add).not.toContain('createSpecOptionValue');
    expect(board).toContain('addNamedSpecToLine');
    expect(board).toContain('applyOptionToLine');
    expect(screen).toContain('seedModifiedLineFromVariant');
    expect(screen).toContain('DealerOrderSpecsBoard');
    expect(screen).toContain('DealerMeasurementsBoard');
    expect(screen).toContain('upsertBasketLine');
    expect(screen).toContain('catalogLineWasModified');
    expect(screen).toContain('existingLine');
    expect(screen).toContain('resolveSelectedVariant');
    expect(screen).not.toContain('|| !selectedVariant');
    expect(screen).not.toContain('OrderLineSpecSheet');
  });

  it('keeps productId so customize stays MODIFIED, not CUSTOM', () => {
    const seed = readFileSync(
      join(__dirname, '../../requests/seedModifiedLineFromVariant.ts'),
      'utf8',
    );
    expect(seed).toContain('productId: input.productId');
    expect(seed).toContain('DEALER_NAMED_SPEC_GROUP');
  });
});

describe('PDP customize navigates to the modify page', () => {
  it('pushes customizeVariantHref instead of opening the spec sheet', () => {
    const pdp = read('ProductDetailScreen.tsx');
    expect(pdp).toContain('customizeVariantHref');
    expect(pdp).toContain('pdp-customize-variant');
    expect(pdp).not.toContain('OrderLineSpecSheet');
    expect(pdp).not.toContain('setCustomizeOpen');
  });

  it('does not deep-link Edit item through catalog/[id]/customize', () => {
    const deepLink = readFileSync(join(__dirname, '../newOrderDeepLink.ts'), 'utf8');
    expect(deepLink).toContain('/(app)/(customer)/order/modify');
    expect(deepLink).not.toContain('catalog/${id}/customize');
  });
});
