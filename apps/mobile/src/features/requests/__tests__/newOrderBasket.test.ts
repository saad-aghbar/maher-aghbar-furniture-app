import { emptyOrderLine } from '../newOrderLine';
import {
  addEmptyBasketLine,
  applyCatalogProductToBasket,
  removeBasketLine,
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

  it('adds extra lines and can remove the last remaining row', () => {
    const lines = addEmptyBasketLine([emptyOrderLine({ productId: 'p1', customProductName: 'A' })]);
    expect(lines).toHaveLength(2);
    const kept = removeBasketLine(lines, lines[1].id);
    expect(kept).toHaveLength(1);
    expect(removeBasketLine(kept, kept[0].id)).toHaveLength(0);
  });
});
