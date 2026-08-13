import { collectionsFromProducts } from '../collectionsFromProducts';
import type { BrowseProduct } from '@/features/catalog/api';

const sofa: BrowseProduct = {
  id: 'p1',
  sku: 'SF-001',
  nameEn: 'Modern Sofa',
  nameAr: 'كنبة عصرية',
  imageUrl: 'https://img/sofa.jpg',
  isActive: true,
  price: 850,
  dealerPrice: 850,
  priceCurrency: 'ILS',
  categoryId: 'cat1',
  category: { id: 'cat1', code: 'SOFA', nameEn: 'Sofas', nameAr: 'كنب' },
};

const table: BrowseProduct = {
  id: 'p2',
  sku: 'TB-010',
  nameEn: 'Dining Table',
  nameAr: 'طاولة طعام',
  thumbnailUrl: 'https://img/table-thumb.jpg',
  imageUrl: 'https://img/table.jpg',
  isActive: true,
  price: 1200,
  dealerPrice: 1200,
  priceCurrency: 'ILS',
  categoryId: 'cat2',
  category: { id: 'cat2', code: 'TABLE', nameEn: 'Tables', nameAr: 'طاولات' },
};

describe('collectionsFromProducts', () => {
  it('groups live products by category with real imagery and counts', () => {
    const tiles = collectionsFromProducts(
      [sofa, { ...sofa, id: 'p1b' }, table],
      'en',
    );
    expect(tiles).toEqual([
      {
        id: 'cat1',
        title: 'Sofas',
        titleKey: 'sofa',
        imageUrl: 'https://img/sofa.jpg',
        itemCount: 2,
      },
      {
        id: 'cat2',
        title: 'Tables',
        titleKey: 'table',
        imageUrl: 'https://img/table-thumb.jpg',
        itemCount: 1,
      },
    ]);
  });

  it('returns empty when products have no category imagery', () => {
    expect(
      collectionsFromProducts(
        [{ ...sofa, imageUrl: null, category: null, categoryId: null }],
        'en',
      ),
    ).toEqual([]);
  });

  it('uses Arabic category names', () => {
    expect(collectionsFromProducts([sofa], 'ar')[0]?.title).toBe('كنب');
  });
});
