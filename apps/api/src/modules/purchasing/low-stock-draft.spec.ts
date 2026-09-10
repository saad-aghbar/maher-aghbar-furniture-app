import { countBuyAlert, groupLowStockDraft, suggestedReorderQty } from './low-stock-draft';

function item(partial: {
  id: string;
  preferredSupplierId?: string | null;
  reorderQty?: number | null;
  minStock?: number;
  onHandQty?: number;
  isPurchasable?: boolean;
  coveredByOpenOrder?: boolean;
  stillNeeded?: number;
}) {
  return {
    id: partial.id,
    sku: partial.id,
    nameEn: partial.id,
    nameAr: partial.id,
    unit: 'pcs',
    minStock: partial.minStock ?? 10,
    reorderQty: partial.reorderQty ?? null,
    onHandQty: partial.onHandQty ?? 2,
    standardCost: 5,
    preferredSupplierId: partial.preferredSupplierId ?? null,
    preferredSupplier: partial.preferredSupplierId
      ? { id: partial.preferredSupplierId, name: partial.preferredSupplierId }
      : null,
    isPurchasable: partial.isPurchasable ?? true,
    coveredByOpenOrder: partial.coveredByOpenOrder ?? false,
    stillNeeded: partial.stillNeeded,
  };
}

describe('low-stock-draft', () => {
  it('prefers reorderQty over the fallback formula', () => {
    expect(suggestedReorderQty({ reorderQty: 50, minStock: 10, onHandQty: 2 })).toBe(50);
    expect(suggestedReorderQty({ reorderQty: 0, minStock: 10, onHandQty: 2 })).toBe(18);
    expect(suggestedReorderQty({ reorderQty: null, minStock: 10, onHandQty: 2 })).toBe(18);
  });

  it('groups by preferred supplier and keeps an unassigned bucket', () => {
    const { groups, unassigned } = groupLowStockDraft([
      item({ id: 'oak', preferredSupplierId: 'wood-co', reorderQty: 40 }),
      item({ id: 'pine', preferredSupplierId: 'wood-co', reorderQty: 20 }),
      item({ id: 'foam', preferredSupplierId: 'foam-co' }),
      item({ id: 'glue' }),
    ]);
    expect(groups).toHaveLength(2);
    const wood = groups.find((g) => g.supplierId === 'wood-co');
    expect(wood?.items.map((i) => i.id)).toEqual(['oak', 'pine']);
    expect(wood?.items[0]?.suggestedQty).toBe(40);
    expect(unassigned.items.map((i) => i.id)).toEqual(['glue']);
  });

  it('keeps items already covered by an open order so the UI can chip them', () => {
    const { groups, unassigned } = groupLowStockDraft([
      item({ id: 'oak', preferredSupplierId: 'wood-co', coveredByOpenOrder: true }),
    ]);
    expect(unassigned.items).toHaveLength(0);
    expect(groups[0]?.items[0]?.id).toBe('oak');
    expect(groups[0]?.items[0]?.coveredByOpenOrder).toBe(true);
  });

  it('marks overlapping low-stock and production as BOTH', () => {
    const { groups } = groupLowStockDraft([
      item({
        id: 'oak',
        preferredSupplierId: 'wood-co',
        minStock: 10,
        onHandQty: 2,
        stillNeeded: 12,
      }),
    ]);
    expect(groups[0]?.items[0]?.reason).toBe('BOTH');
  });

  it('includes production shortages that are not below min stock', () => {
    const { groups } = groupLowStockDraft([
      item({
        id: 'oak',
        preferredSupplierId: 'wood-co',
        minStock: 10,
        onHandQty: 40,
        stillNeeded: 12,
      }),
    ]);
    expect(groups[0]?.items[0]?.reason).toBe('PRODUCTION');
    expect(groups[0]?.items[0]?.suggestedQty).toBeGreaterThanOrEqual(12);
  });

  it('excludes non-purchasable items', () => {
    const { groups } = groupLowStockDraft([
      item({ id: 'oak', preferredSupplierId: 'wood-co', isPurchasable: false }),
    ]);
    expect(groups).toHaveLength(0);
  });

  it('counts unique buy-alert items with overlapping reasons', () => {
    const { groups, unassigned } = groupLowStockDraft([
      item({ id: 'oak', preferredSupplierId: 'wood-co', stillNeeded: 4 }),
      item({ id: 'glue' }),
    ]);
    expect(countBuyAlert([...groups.flatMap((g) => g.items), ...unassigned.items])).toEqual({
      count: 2,
      lowStockCount: 2,
      productionCount: 1,
    });
  });

  it('excludes items that are not low stock', () => {
    const { groups } = groupLowStockDraft([
      item({ id: 'oak', preferredSupplierId: 'wood-co', minStock: 10, onHandQty: 11 }),
    ]);
    expect(groups).toHaveLength(0);
  });
});
