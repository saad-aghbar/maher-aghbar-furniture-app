import { formatRequestItemSpec } from '../requestItemSpec';

describe('formatRequestItemSpec', () => {
  it('renders variant, dims, options and fabrics for the admin desk', () => {
    expect(
      formatRequestItemSpec({
        productName: 'Karina',
        quantity: 1,
        variantLabel: 'أوكرانيه',
        width: 250,
        height: 90,
        depth: 95,
        orientation: 'LEFT',
        foamDensity: 'D35',
        finish: 'GOLD',
        fabricType: 'Velvet',
        fabrics: [{ type: 'Velvet', color: 'Gold', role: 'Body' }],
      }),
    ).toContain('أوكرانيه');
  });
});
