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

describe('production problems floor', () => {
  it('opens the inbox from a 48px floor trigger on the hub', () => {
    const hub = read('ProductionOverviewScreen.tsx');
    const bar = read('components/ProductionProblemsBar.tsx');
    expect(hub).toContain('ProductionProblemsBar');
    expect(hub).toContain('useProductionProblemsQuery');
    expect(hub).not.toContain('PrimaryButton');
    expect(bar).toContain('height: 48');
    expect(bar).toContain('warning-outline');
    expect(bar).toContain('orderBoardShadow');
    expect(bar).toContain('AnimatedPressable');
    expect(bar).toContain("locale === 'ar' ? 'medium'");
    assertFloor(hub);
    assertFloor(bar);
  });

  it('filters Open / Answered / All with a 40px wood-bubble touch bar', () => {
    const page = read('ProductionProblemsScreen.tsx');
    const tabs = read('components/ProductionProblemsTouchBar.tsx');
    expect(page).toContain('ProductionProblemsTouchBar');
    expect(page).toContain('ScreenBackLead');
    expect(page).toContain('theme.sizes.touch.min');
    expect(page).toContain("locale === 'ar' ? 'medium'");
    expect(tabs).toContain('PILL_HEIGHT = 40');
    expect(tabs).toContain('useDraggablePillBar');
    expect(tabs).toContain("['open', 'answered', 'all']");
    expect(tabs).toContain('orderBoardShadow');
    expect(tabs).toContain('problemsEyebrow');
    expect(page).not.toContain("(['open', 'answered', 'all'] as const)");
    assertFloor(page);
    assertFloor(tabs);
  });

  it('lists tickets as floor boards with an empty panel', () => {
    const page = read('ProductionProblemsScreen.tsx');
    const ticket = read('components/ProductionProblemTicket.tsx');
    expect(page).toContain('ProductionProblemTicket');
    expect(page).toContain('DealerEmptyPanel');
    expect(page).toContain('ListItemEnter');
    expect(page).not.toContain('EmptyState');
    expect(ticket).toContain('orderBoardShadow');
    expect(ticket).toContain('StatusBadge');
    expect(ticket).toContain('width: 3');
    expect(ticket).toContain('surfaceSecondary');
    expect(ticket).toContain('theme.sizes.touch.min');
    expect(ticket).toContain("locale === 'ar' ? 'medium'");
    expect(ticket).toContain('problemCategoryLabel');
    assertFloor(ticket);
  });
});
