import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '..');

function read(rel: string) {
  return readFileSync(join(dir, rel), 'utf8');
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
}

describe('production basket boards floor', () => {
  it('uses one board recipe on the hub for day and all-time', () => {
    const hub = read('ProductionOverviewScreen.tsx');
    const query = read('query.ts');
    const board = read('components/ProductionBasketBoard.tsx');
    const row = read('components/ProductionBasketItemRow.tsx');
    expect(hub).toContain('ProductionBasketBoard');
    expect(hub).toContain('selectProductionBasketBoard');
    expect(hub).toContain('ProductionComplexityChrome');
    expect(hub).not.toContain('ProductionDayOrderCard');
    expect(hub).not.toContain('ProductionOrderCard');
    expect(query).toContain("group: 'boards'");
    expect(board).toContain('orderBoardShadow');
    expect(board).toContain('WorkflowProgressHit');
    expect(board).toContain('basketItemsOf');
    expect(board).toContain("locale === 'ar' ? 'medium'");
    expect(row).toContain('size={THUMB}');
    expect(row).toContain('THUMB = 56');
    expect(row).toContain('brandSoft');
    expect(row).toContain('width: 3');
    assertFloor(hub);
    assertFloor(board);
    assertFloor(row);
  });

  it('filters All / Standard / Modified / Custom with period cells', () => {
    const chrome = read('components/ProductionComplexityChrome.tsx');
    expect(chrome).toContain("['all', 'STANDARD', 'MODIFIED', 'CUSTOM']");
    expect(chrome).toContain('brandSoft');
    expect(chrome).toContain('height: 3');
    expect(chrome).toContain("locale === 'ar' ? 'medium'");
    expect(chrome).not.toContain('DeskCard');
    expect(chrome).not.toContain('colors.info');
  });
});
