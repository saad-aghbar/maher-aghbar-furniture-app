import { describe, expect, it } from 'vitest';
import {
  appendBasketLine,
  applyCatalogProductToBasket,
  emptyBasketLine,
  lineToRequestItem,
  patchBasketLine,
} from './basket';

describe('dealer basket lines', () => {
  it('keeps a raised quantity on one request item and appends the same product again', () => {
    const one = applyCatalogProductToBasket([emptyBasketLine()], {
      productId: 'p1',
      quantity: '1',
      customProductName: 'Chair',
    });
    const raised = patchBasketLine(one, one[0]!.id, {
      quantity: '8',
      notes: 'Same fabric',
      fabrics: [{ ...one[0]!.fabrics[0]!, type: 'Linen', color: 'Sand', role: 'Body' }],
    });
    expect(raised).toHaveLength(1);
    const shared = lineToRequestItem(raised[0]!, 'Item');
    expect(shared.quantity).toBe(8);
    expect(shared.fabric).toBe('Linen');
    expect(shared.notes).toBe('Same fabric');

    const again = applyCatalogProductToBasket(raised, {
      productId: 'p1',
      quantity: '1',
      customProductName: 'Chair',
      preferUpdate: true,
    });
    expect(again).toHaveLength(2);
    expect(again[0]?.id).toBe(raised[0]?.id);
    expect(again[0]?.quantity).toBe('8');
    expect(lineToRequestItem(again[1]!, 'Item').quantity).toBe(1);
  });

  it('appends a custom item as its own request item', () => {
    const catalog = applyCatalogProductToBasket([emptyBasketLine()], {
      productId: 'p1',
      quantity: '2',
      customProductName: 'Chair',
    });
    const custom = emptyBasketLine({ customProductName: 'Bench', productId: '', notes: 'Oak frame' });
    const next = appendBasketLine(catalog, custom);
    const items = next.map((line) => lineToRequestItem(line, 'Item'));
    expect(items).toHaveLength(2);
    expect(items[1]?.productName).toBe('Bench');
    expect(items[1]?.notes).toBe('Oak frame');
    expect(items[1]?.productId).toBeUndefined();
  });
});
