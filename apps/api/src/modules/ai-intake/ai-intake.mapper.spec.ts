import { lineItemsToRequestCreate } from './ai-intake.mapper';

describe('lineItemsToRequestCreate', () => {
  it('classifies AI lines as CUSTOM and never leaves complexity null', () => {
    const rows = lineItemsToRequestCreate(
      [{ productName: 'Corner sofa from photo', quantity: '1' }],
      'Created from AI intake',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.productId).toBeUndefined();
    expect(rows[0]?.manufacturingComplexity).toBe('CUSTOM');
    expect(rows[0]?.productName).toBe('Corner sofa from photo');
  });

  it('does not treat notes or fabric as a catalog match', () => {
    const rows = lineItemsToRequestCreate([
      {
        productName: 'Milano Sofa',
        quantity: '2',
        fabricType: 'Velvet',
        notes: 'Looks like the catalog Milano',
      },
    ]);
    expect(rows[0]?.manufacturingComplexity).toBe('CUSTOM');
    expect(rows[0]?.productId).toBeUndefined();
  });

  it('classifies WhatsApp-style extracted lines as CUSTOM, never STANDARD', () => {
    const rows = lineItemsToRequestCreate(
      [
        {
          productName: 'Corner sofa from WhatsApp photo',
          quantity: '1',
          width: '300',
          fabricType: 'Velvet',
        },
      ],
      'Created from inbound WhatsApp — draft for review',
    );
    expect(rows[0]?.manufacturingComplexity).toBe('CUSTOM');
    expect(rows[0]?.productId).toBeUndefined();
    expect(rows.every((row) => row.manufacturingComplexity !== 'STANDARD')).toBe(true);
    expect(rows.every((row) => row.manufacturingComplexity != null)).toBe(true);
  });
});
