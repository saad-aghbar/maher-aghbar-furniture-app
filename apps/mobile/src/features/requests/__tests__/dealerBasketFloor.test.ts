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

  it('fabric type and colour are pickers, not catch-all text boxes', () => {
    const editor = read('FabricSelectionsEditor.tsx');
    expect(editor).toContain('NamedPickerSheet');
    expect(editor).toContain('fabricOptions');
    expect(editor).not.toMatch(/catch-all|free.?text box/i);
  });
});
