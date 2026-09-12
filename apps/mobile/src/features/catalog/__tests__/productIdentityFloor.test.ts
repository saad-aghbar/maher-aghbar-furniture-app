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

describe('Admin product identity floor', () => {
  it('keeps parchment boards and forbids SaaS cards', () => {
    const product = read('AdminProductDetailScreen.tsx');
    const create = read('components/CreateProductSheet.tsx');
    assertFloor(product);
    assertFloor(create);
    expect(product).toMatch(/MoreBoard|orderBoardShadow|AnimatedPressable/);
    expect(create).toMatch(/BottomSheet|orderBoardShadow|AnimatedPressable/);
  });

  it('asks only for identity on create and product detail', () => {
    const product = read('AdminProductDetailScreen.tsx');
    const create = read('components/CreateProductSheet.tsx');
    expect(product).toContain('standardVariant');
    expect(product).toContain('createStandardVariantHint');
    expect(product).not.toContain('SellerPriceFloorRow');
    expect(product).not.toContain('ProductWorkflowSection');
    expect(product).not.toContain('bomDefaults');
    expect(product).not.toContain('manufacturingCost');
    expect(create).not.toContain('bomDefaults');
    expect(create).not.toContain('manufacturingCost');
    expect(create).not.toContain('basePrice');
  });
});
