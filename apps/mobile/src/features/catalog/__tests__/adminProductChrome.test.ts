import { adminProductChromeTitle } from '../adminProductChrome';

const sofa = {
  nameEn: '3-Seater Sofa Standard',
  nameAr: '',
  nameHe: '',
  sku: 'SOF-3S-STD',
  fallback: 'Product',
};

describe('adminProductChromeTitle', () => {
  it('uses Name (EN) for English, not the generic Product chrome', () => {
    expect(adminProductChromeTitle({ locale: 'en', ...sofa })).toBe(
      '3-Seater Sofa Standard',
    );
  });

  it('keeps empty Name (AR) empty and falls back to EN, then SKU', () => {
    expect(adminProductChromeTitle({ locale: 'ar', ...sofa })).toBe(
      '3-Seater Sofa Standard',
    );
    expect(
      adminProductChromeTitle({
        locale: 'ar',
        ...sofa,
        nameEn: '',
      }),
    ).toBe('SOF-3S-STD');
  });

  it('falls back to Arabic when English is blank', () => {
    expect(
      adminProductChromeTitle({
        locale: 'en',
        nameEn: '  ',
        nameAr: 'كرينا',
        sku: 'SOF-3S-STD',
        fallback: 'Product',
      }),
    ).toBe('كرينا');
  });

  it('uses the product SKU when names are blank', () => {
    expect(
      adminProductChromeTitle({
        locale: 'en',
        nameEn: '  ',
        nameAr: '',
        sku: 'SOF-3S-STD',
        fallback: 'Product',
      }),
    ).toBe('SOF-3S-STD');
  });
});
