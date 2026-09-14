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

describe('plan items manufacture floor', () => {
  it('uses the orders board recipe with readiness stamps, not nested white tiles', () => {
    const screen = read('OrderProductionPlanItemBoard.tsx');
    const card = read('components/PlanItemFloorCard.tsx');
    const host = read('OrderProductionPlanScreen.tsx');
    expect(screen).toContain('PlanItemFloorCard');
    expect(screen).toContain('selectPlanItemsFloor');
    expect(screen).toContain('DealerBoard');
    expect(screen).toContain('DealerEmptyPanel');
    expect(screen).toContain('WorkflowProgressHit');
    expect(screen).toContain('largeTitle');
    expect(screen).toContain("locale === 'ar' ? 'medium'");
    expect(screen).not.toContain('manufacturingComplexityDisplayKey');
    expect(host).toContain('orderNumber=');
    expect(card).toContain('orderBoardShadow');
    expect(card).toContain('THUMB = 56');
    expect(card).toContain('size={THUMB}');
    expect(card).toContain('ProductThumb');
    expect(card).toContain('git-network-outline');
    expect(card).toContain('planStampSpec');
    expect(card).toContain('height: 3');
    expect(card).toContain('brandSoft');
    expect(card).toContain('section.alert');
    expect(card).toContain("locale === 'ar' ? 'medium'");
    expect(card).not.toContain('EmptyProductImage');
    assertFloor(screen);
    assertFloor(card);
    assertFloor(host);
  });
});
