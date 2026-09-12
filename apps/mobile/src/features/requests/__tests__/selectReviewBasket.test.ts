import { emptyOrderLine } from '../newOrderLine';
import { selectReviewBasketLine } from '../selectReviewBasket';

describe('selectReviewBasketLine', () => {
  it('keeps fabrics, dimensions and notes on each item', () => {
    const line = emptyOrderLine({
      customProductName: 'Karina',
      variantLabel: 'Ukrainian',
      quantity: '2',
      dimWidth: '250',
      dimHeight: '90',
      dimDepth: '95',
      notes: 'Gold piping',
      fabrics: [
        {
          key: 'f1',
          type: 'Velvet',
          color: 'Gold',
          role: 'Body',
          code: '',
          quantity: '',
          notes: '',
        },
      ],
    });
    expect(selectReviewBasketLine(line, 'Untitled', 'Standard')).toEqual({
      name: 'Karina',
      quantity: '2',
      variant: 'Ukrainian',
      fabric: 'Velvet · Gold · Body',
      dimensions: 'W 250 × H 90 × D 95 cm',
      notes: 'Gold piping',
    });
  });
});
