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

describe('Dealer basket floor', () => {
  const files = [
    'components/OrderBasketBoard.tsx',
    'components/OrderBasketLineCard.tsx',
    'components/OrderBasketItemRail.tsx',
    'OrderBasketScreen.tsx',
    'NewOrderScreen.tsx',
    'components/OrderLineSpecSheet.tsx',
    'components/NamedPickerSheet.tsx',
    'FabricSelectionsEditor.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(/DealerBoard|orderBoardShadow|AnimatedPressable|BottomSheet|NamedPickerSheet/);
    }
  });

  it('opens the modify desk and custom desk instead of a spec sheet', () => {
    const screen = read('OrderBasketScreen.tsx');
    expect(screen).toContain('customItemHref');
    expect(screen).toContain('customizeVariantHref');
    expect(screen).not.toContain('OrderLineSpecSheet');
    expect(screen).not.toContain('addEmptyBasketLine');
    expect(screen).toContain('DEALER_TAB_BAR_CLEARANCE');
  });

  it('opens the item desk from New Order instead of dimensions and a spec sheet', () => {
    const screen = read('NewOrderScreen.tsx');
    expect(screen).toContain('customItemHref');
    expect(screen).toContain('customizeVariantHref');
    expect(screen).toContain('editItem');
    expect(screen).not.toContain('OrderLineSpecSheet');
    expect(screen).not.toContain('NewOrderDimensionsEditor');
    expect(screen).not.toContain('editLineSpec');
  });

  it('uses a trash well and edit-variant chip on each ticket', () => {
    const card = read('components/OrderBasketLineCard.tsx');
    expect(card).toContain('trash-outline');
    expect(card).toContain('editProductVariant');
    expect(card).toContain('waitingForFactoryPrice');
    expect(card).not.toContain('editLineSpec');
    expect(card).not.toContain('addLinePhoto');
    expect(card).not.toContain('TextField');
  });

  it('renders the New Order packing slip instead of a chip wrap', () => {
    const rail = read('components/OrderBasketItemRail.tsx');
    expect(rail).toContain('bag-handle-outline');
    expect(rail).toContain('trash-outline');
    expect(rail).toContain('basketLineKind');
    expect(rail).toContain('lineVisualIdentity');
    expect(rail).toContain('basketEditingPiece');
    expect(rail).toContain('openBasketDesk');
    expect(rail).toContain('pairRows');
  });

  it('fabric type and colour are pickers, not catch-all text boxes', () => {
    const editor = read('FabricSelectionsEditor.tsx');
    expect(editor).toContain('NamedPickerSheet');
    expect(editor).toContain('fabricOptions');
    expect(editor).not.toMatch(/catch-all|free.?text box/i);
  });
});
