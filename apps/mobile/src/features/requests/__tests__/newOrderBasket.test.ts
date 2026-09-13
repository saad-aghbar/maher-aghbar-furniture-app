import { emptyOrderLine, normalizeOrderLine } from '../newOrderLine';
import {
  addEmptyBasketLine,
  appendBasketLine,
  applyCatalogProductToBasket,
  basketLineKind,
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

  it('updates the single existing product line when preferUpdate (STD → named variant)', () => {
    const one = applyCatalogProductToBasket([emptyOrderLine()], {
      productId: 'p1',
      quantity: '2',
      variantId: 'std',
      dimWidth: '220',
    });
    const updated = applyCatalogProductToBasket(
      one,
      {
        productId: 'p1',
        quantity: '2',
        variantId: 'xl',
        variantLabel: 'Karina',
        dimWidth: '250',
      },
      { preferUpdate: true },
    );
    expect(updated).toHaveLength(1);
    expect(updated[0]?.variantId).toBe('xl');
    expect(updated[0]?.dimWidth).toBe('250');
  });

  it('appends when several lines of the same product already exist', () => {
    const two = [
      emptyOrderLine({ productId: 'p1', customProductName: 'A', variantId: 'std' }),
      emptyOrderLine({ productId: 'p1', customProductName: 'A', variantId: 'xl' }),
    ];
    const next = applyCatalogProductToBasket(
      two,
      { productId: 'p1', quantity: '1', variantId: 'ukr' },
      { preferUpdate: true },
    );
    expect(next).toHaveLength(3);
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
