import { emptyOrderLine, lineToRequestItem } from '../newOrderLine';
import {
  addNamedSpecToLine,
  catalogLineWasModified,
  removeNamedSpecFromLine,
  seedModifiedLineFromVariant,
} from '../seedModifiedLineFromVariant';
import { seedDimensionsFromVariant } from '../newOrderMeasurements';
import type { AdminProductVariant } from '@/api/modules/catalogAdmin';

const variant: AdminProductVariant = {
  id: 'v-olive',
  productId: 'p-sofa',
  sku: 'SOF-2S-OLIVE',
  code: 'SOF-2S-OLIVE',
  nameAr: 'كنبة زيتوني',
  nameEn: 'Loveseat olive linen',
  isDefault: false,
  isActive: true,
  sortOrder: 2,
  width: 160,
  height: 85,
  depth: 95,
  seatHeight: 45,
  measurements: [
    {
      key: 'arm',
      labelAr: 'ارتفاع الذراع',
      labelEn: 'Arm height',
      value: 62,
      unit: 'cm',
    },
  ],
  options: [
    {
      specOptionValueId: 'opt-foam',
      specOptionValue: {
        id: 'opt-foam',
        groupId: 'g-foam',
        code: 'D35',
        nameEn: 'Foam 35',
        nameAr: 'إسفنج 35',
        group: {
          id: 'g-foam',
          code: 'FOAM_DENSITY',
          nameEn: 'Foam density',
          nameAr: 'كثافة الإسفنج',
        },
      },
    },
  ],
};

describe('seedModifiedLineFromVariant', () => {
  it('keeps the catalog product id and seeds variant dims, measurements, and specs', () => {
    const line = seedModifiedLineFromVariant({
      productId: 'p-sofa',
      productName: 'Modern Sofa',
      quantity: '2',
      variant,
      locale: 'en',
    });
    expect(line.productId).toBe('p-sofa');
    expect(line.variantId).toBe('v-olive');
    expect(line.variantLabel).toBe('Loveseat olive linen');
    expect(line.dimWidth).toBe('160');
    expect(line.dimSeat).toBe('45');
    expect(line.customMeasurements).toEqual([
      expect.objectContaining({ label: 'Arm height', value: '62', unit: 'cm' }),
    ]);
    expect(line.options[0]).toEqual(
      expect.objectContaining({
        specOptionValueId: 'opt-foam',
        groupId: 'g-foam',
        groupCode: 'FOAM_DENSITY',
        code: 'D35',
      }),
    );
  });

  it('uses Arabic labels for variant measurements', () => {
    const dims = seedDimensionsFromVariant(variant, 'ar');
    expect(dims.custom[0]?.label).toBe('ارتفاع الذراع');
  });

  it('sends dealer-named specs without a library UUID so validation passes', () => {
    const seeded = seedModifiedLineFromVariant({
      productId: 'p-sofa',
      productName: 'Modern Sofa',
      quantity: '1',
      variant,
      locale: 'en',
    });
    const withOwn = addNamedSpecToLine(seeded, 'Piping', 'Gold on the back');
    const item = lineToRequestItem(withOwn, 'Untitled', 'Seat');
    expect(item.productId).toBe('p-sofa');
    expect(item.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specOptionValueId: 'opt-foam', code: 'D35' }),
        expect.objectContaining({
          groupCode: 'DEALER_SPEC',
          nameEn: 'Piping',
          note: 'Gold on the back',
        }),
      ]),
    );
    expect(item.options?.find((opt) => opt.groupCode === 'DEALER_SPEC')).not.toHaveProperty(
      'specOptionValueId',
    );
    expect(removeNamedSpecFromLine(withOwn, 'PIPING').options).toHaveLength(1);
  });

  it('does not drop an empty catalog line when adding a named spec', () => {
    const next = addNamedSpecToLine(emptyOrderLine({ productId: 'p1' }), '  ', 'x');
    expect(next.options).toHaveLength(0);
  });

  it('marks MODIFIED only when specs, dims, or dealer measurements change', () => {
    const catalog = seedModifiedLineFromVariant({
      productId: 'p-sofa',
      productName: 'Modern Sofa',
      quantity: '1',
      variant,
      locale: 'en',
    });
    expect(catalogLineWasModified({ ...catalog, quantity: '4', notes: 'Rush' }, catalog)).toBe(
      false,
    );
    expect(catalogLineWasModified({ ...catalog, dimWidth: '180' }, catalog)).toBe(true);
    expect(catalogLineWasModified(addNamedSpecToLine(catalog, 'Piping', 'Gold'), catalog)).toBe(
      true,
    );
  });
});
