import { readFileSync } from 'fs';
import { join } from 'path';

const returnsDir = join(__dirname, '..');
const tasksDir = join(__dirname, '../../tasks');

function read(path: string) {
  return readFileSync(path, 'utf8');
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
}

describe('returns pop-up floor', () => {
  it('lets the piece decision sheet use floor boards and a pixel sheet height', () => {
    const sheet = read(join(returnsDir, 'components/ReturnPieceDecisionSheet.tsx'));
    expect(sheet).toContain('ScrollView');
    expect(sheet).toContain('DealerBoard');
    expect(sheet).toContain('useWindowDimensions');
    expect(sheet).toContain('Math.round(windowH');
    expect(sheet).not.toContain('sheetHeight={0.88}');
    expect(sheet).toContain('pieceConfirm');
    expect(sheet).toContain('accessibilityLabel');
    assertFloor(sheet);
  });

  it('keeps create-return line pickers on the floor recipe', () => {
    const screen = read(join(returnsDir, 'CreateReturnScreen.tsx'));
    expect(screen).toContain('QtyStepperField');
    expect(screen).toContain('qtyByLine');
    expect(screen).toContain('ListItemEnter');
    expect(screen).toContain('orderBoardShadow');
    expect(screen).toContain('AnimatedPressable');
    assertFloor(screen);
  });

  it('uses the shared plus-minus stepper for responsibility amounts', () => {
    const board = read(join(returnsDir, 'components/ReturnResponsibilityBoard.tsx'));
    expect(board).toContain('QtyStepperField');
    expect(board).toContain('dealerShare');
    expect(board).toContain('factoryShare');
    expect(board).toContain('unit="₪"');
    expect(board).toContain('recordDealerAccept');
    expect(board).toContain('recordDealerReject');
    expect(board).toContain('factoryOverrideHint');
    expect(board).toContain('dealerAcceptHint');
    expect(board).toContain('ReturnSheetFooter');
    expect(board).toContain('returnCtaStyle');
    assertFloor(board);
  });

  it('uses one full-pill CTA on every returns page and sheet', () => {
    const files = [
      'ReturnDetailScreen.tsx',
      'ReturnsListScreen.tsx',
      'CreateReturnScreen.tsx',
      'components/ReturnSheetFooter.tsx',
      'components/returnFloorCta.ts',
      'components/ReturnReceiveSheet.tsx',
      'components/ReturnPieceDecisionSheet.tsx',
      'components/ReturnOrderPickerSheet.tsx',
      'components/ReturnsStatusFilterSheet.tsx',
      'components/ReturnPieceSheet.tsx',
      'components/ReturnPiecesBoard.tsx',
    ];
    for (const file of files) {
      const source = read(join(returnsDir, file));
      expect(source).toMatch(/returnCtaStyle|ReturnSheetFooter/);
      expect(source).not.toContain('style={{ borderRadius: theme.radius.xl }}');
      expect(source).not.toContain("style={{ borderRadius: theme.radius.md }}");
      assertFloor(source);
    }
    const cta = read(join(returnsDir, 'components/returnFloorCta.ts'));
    expect(cta).toContain('radius.full');
    expect(cta).toContain('sizes.touch.min');
  });

  it('keeps the return piece hierarchy on floor boards', () => {
    const board = read(join(returnsDir, 'components/ReturnPiecesBoard.tsx'));
    expect(board).toContain('DealerBoard');
    expect(board).toContain('orderBoardShadow');
    expect(board).toContain('ListItemEnter');
    expect(board).toContain('openProduction');
    expect(board).toContain('openRecovery');
    expect(board).toContain('accessibilityLabel');
    assertFloor(board);
  });

  it('keeps recovery capture on floor boards with a pixel sheet height', () => {
    const section = read(join(tasksDir, 'components/TaskRecoveryFloorSection.tsx'));
    const cards = read(join(tasksDir, 'components/recoveryFloorCards.tsx'));
    const bar = read(join(tasksDir, 'components/RecoveryOutcomeTouchBar.tsx'));
    const dest = read(
      join(tasksDir, '../purchasing/components/DestinationPickSheet.tsx'),
    );
    expect(section).toContain('DealerBoard');
    expect(section).toContain('useWindowDimensions');
    expect(section).toContain('Math.round(windowH');
    expect(section).toContain('BomMaterialPickerSheet');
    expect(section).toContain('keepOpenOnPick');
    expect(section).toContain('recoveryPickHint');
    expect(section).toContain('overlay');
    expect(section).toContain('InventorySheetBody');
    expect(section).toContain('InventorySheetFooter');
    expect(section).toContain('DestinationPickSheet');
    expect(section).toContain('RecoveryOutcomeTouchBar');
    expect(section).toContain('accessibilityLabel');
    expect(bar).toContain('RolesTouchBar');
    expect(cards).toContain('WarehouseBinBoard');
    expect(cards).toContain('locationsForWarehouse');
    expect(
      read(join(tasksDir, '../inventory/components/WarehouseBinBoard.tsx')),
    ).toContain('SearchBarShell');
    expect(cards).toContain('InventorySkuThumb');
    expect(cards).toContain('StatusBadge');
    expect(
      read(join(tasksDir, '../inventory/components/InventorySheetBody.tsx')),
    ).toContain('ScrollView');
    expect(dest).toContain('SearchBarShell');
    expect(dest).toContain('PurchasingWarehousePickList');
    assertFloor(section);
    assertFloor(cards);
    assertFloor(bar);
  });

  it('lets returns filter and order picker sheets scroll past the fold', () => {
    const filter = read(join(returnsDir, 'components/ReturnsStatusFilterSheet.tsx'));
    const picker = read(join(returnsDir, 'components/ReturnOrderPickerSheet.tsx'));
    expect(filter).toContain('expandable');
    expect(filter).toContain('ScrollView');
    expect(picker).toContain('expandable');
    expect(picker).toContain('ScrollView');
  });
});
