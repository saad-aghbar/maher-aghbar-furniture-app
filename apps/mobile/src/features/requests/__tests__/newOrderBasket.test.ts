import { emptyOrderLine, lineToRequestItem, normalizeOrderLine } from '../newOrderLine';
import {
  addEmptyBasketLine,
  appendBasketLine,
  applyCatalogProductToBasket,
  basketLineKind,
  patchBasketLine,
  removeBasketLine,
  upsertBasketLine,
} from '../newOrderBasket';

describe('dealer basket mutations', () => {
  it('fills the empty first line then appends later catalog picks', () => {
    const empty = [emptyOrderLine()];
    const one = applyCatalogProductToBasket(empty, {
      productId: 'p1',
      quantity: '2',
      customProductName: 'Karina',
    });
    expect(one).toHaveLength(1);
    expect(one[0].productId).toBe('p1');
    const two = applyCatalogProductToBasket(one, {
      productId: 'p2',
      quantity: '1',
      customProductName: 'Milano',
    });
    expect(two).toHaveLength(2);
    expect(two[1].productId).toBe('p2');
    expect(two[0].id).toBe(one[0].id);
  });

  it('keeps a raised quantity on one request item and appends the same product again', () => {
    const one = applyCatalogProductToBasket([emptyOrderLine()], {
      productId: 'p1',
      quantity: '1',
      customProductName: 'Chair',
      variantId: 'std',
      dimWidth: '220',
    });
    const raised = patchBasketLine(one, one[0].id, {
      quantity: '8',
      notes: 'Same fabric',
      fabrics: [{ ...one[0].fabrics[0], type: 'Linen', color: 'Sand', role: 'Body' }],
    });
    expect(raised).toHaveLength(1);
    const shared = lineToRequestItem(raised[0], 'Item', 'Seat');
    expect(shared.quantity).toBe(8);
    expect(shared.fabric).toBe('Linen');
    expect(shared.notes).toBe('Same fabric');

    const again = applyCatalogProductToBasket(raised, {
      productId: 'p1',
      quantity: '1',
      customProductName: 'Chair',
      variantId: 'xl',
      dimWidth: '250',
      preferUpdate: true,
    });
    expect(again).toHaveLength(2);
    expect(again[0]?.id).toBe(raised[0].id);
    expect(again[0]?.variantId).toBe('std');
    expect(again[0]?.quantity).toBe('8');
    expect(again[1]?.variantId).toBe('xl');
    const items = again.map((line) => lineToRequestItem(line, 'Item', 'Seat'));
    expect(items[1]?.quantity).toBe(1);
    expect(items[1]?.productId).toBe('p1');
  });

  it('appends a custom item as its own request item', () => {
    const catalog = applyCatalogProductToBasket([emptyOrderLine()], {
      productId: 'p1',
      quantity: '2',
      customProductName: 'Chair',
    });
    const custom = emptyOrderLine({ customProductName: 'Bench', notes: 'Oak frame' });
    const next = appendBasketLine(catalog, custom);
    const items = next.map((line) => lineToRequestItem(line, 'Item', 'Seat'));
    expect(items).toHaveLength(2);
    expect(items[1]?.productName).toBe('Bench');
    expect(items[1]?.notes).toBe('Oak frame');
    expect(items[1]?.productId).toBeUndefined();
  });

  it('appends a modified customize line beside an existing catalog pick', () => {
    const one = applyCatalogProductToBasket([emptyOrderLine()], {
      productId: 'p1',
      quantity: '1',
      customProductName: 'Karina',
    });
    const modified = emptyOrderLine({
      productId: 'p1',
      customProductName: 'Karina',
      variantId: 'v-olive',
      notes: 'Gold piping',
    });
    const next = appendBasketLine(one, modified);
    expect(next).toHaveLength(2);
    expect(next[1]?.notes).toBe('Gold piping');
    expect(next[1]?.id).toBe(modified.id);
  });

  it('adds extra lines and can remove the last remaining row', () => {
    const lines = addEmptyBasketLine([emptyOrderLine({ productId: 'p1', customProductName: 'A' })]);
    expect(lines).toHaveLength(2);
    const kept = removeBasketLine(lines, lines[1].id);
    expect(kept).toHaveLength(1);
    expect(removeBasketLine(kept, kept[0].id)).toHaveLength(0);
  });

  it('marks a catalog line customized after the dealer edits the variant', () => {
    const standard = emptyOrderLine({
      productId: 'p1',
      customProductName: 'Karina',
    });
    expect(basketLineKind(standard)).toBe('standard');
    expect(basketLineKind({ ...standard, notes: 'Gold piping' })).toBe('standard');
    expect(basketLineKind({ ...standard, options: [{ specOptionValueId: 'opt-foam' }] })).toBe(
      'standard',
    );
    expect(basketLineKind({ ...standard, modifiedByDealer: true })).toBe('customized');
    expect(
      basketLineKind(emptyOrderLine({ customProductName: 'Corner bench', productId: '' })),
    ).toBe('custom');
  });

  it('upserts a line by id instead of appending a duplicate', () => {
    const first = emptyOrderLine({ productId: 'p1', customProductName: 'Karina' });
    const patched = { ...first, notes: 'Gold piping', modifiedByDealer: true };
    const next = upsertBasketLine([first], patched);
    expect(next).toHaveLength(1);
    expect(next[0]?.notes).toBe('Gold piping');
    expect(next[0]?.id).toBe(first.id);
  });

  it('keeps local photos when a draft line is normalized', () => {
    const line = normalizeOrderLine(
      {
        id: 'line-1',
        customProductName: 'Corner bench',
        photoUris: ['file://sketch.jpg'],
        modifiedByDealer: false,
      },
      0,
    );
    expect(line?.photoUris).toEqual(['file://sketch.jpg']);
    expect(line?.productId).toBe('');
  });
});
