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

describe('admin order basket boards floor', () => {
  it('uses the production basket recipe on the admin desk, not DeskCard tiles', () => {
    const card = read('components/OrdersProgressCard.tsx');
    const board = read('components/OrderBasketBoard.tsx');
    const row = read('components/OrderBasketItemRow.tsx');
    const hub = read('components/OrdersSignatureHome.tsx');
    const lane = read('laneOrderCard.ts');
    expect(card).toContain('OrderBasketBoard');
    expect(card).toContain('orderBasketItemHref');
    expect(card).not.toContain('DeskCard');
    expect(card).not.toContain('itemStrip');
    expect(hub).toContain('items: o.items');
    expect(board).toContain('orderBoardShadow');
    expect(board).toContain('minHeight: 44');
    expect(board).toContain('brandSoft');
    expect(board).toContain("locale === 'ar' ? 'medium'");
    expect(row).toContain('THUMB = 56');
    expect(row).toContain('size={THUMB}');
    expect(lane).not.toContain('planReadyOf');
    assertFloor(card);
    assertFloor(board);
    assertFloor(row);
  });
});
