import {
  filterLowStockByGroup,
  lowStockBuilderHref,
  lowStockShortfall,
  sortLowStockByShortfall,
  toggleLowStockPick,
} from '../lowStockPick';

const fabric = { id: 'a', category: 'FABRIC', minStock: 10, onHand: 4 };
const foam = { id: 'b', category: 'FOAM', minStock: 6, onHand: 6 };
const wood = { id: 'c', category: 'WOOD', minStock: 8, onHand: 1 };

describe('lowStockPick', () => {
  it('filters by category group', () => {
    expect(filterLowStockByGroup([fabric, foam, wood], 'wood').map((row) => row.id)).toEqual(['c']);
    expect(filterLowStockByGroup([fabric, foam, wood], 'fabric').map((row) => row.id)).toEqual(['a']);
  });

  it('sorts by the biggest shortfall first', () => {
    expect(sortLowStockByShortfall([foam, fabric, wood]).map((row) => row.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(lowStockShortfall(wood)).toBe(7);
  });

  it('toggles selection without mutating the original set', () => {
    const start = new Set<string>();
    const added = toggleLowStockPick(start, 'a');
    expect([...added]).toEqual(['a']);
    expect(start.size).toBe(0);
    expect([...toggleLowStockPick(added, 'a')]).toEqual([]);
  });

  it('builds the purchase-order href from selected ids', () => {
    expect(lowStockBuilderHref([' oak ', 'oak', 'foam'])).toBe(
      '/(app)/(admin)/purchasing/new?itemIds=oak,foam',
    );
  });
});
