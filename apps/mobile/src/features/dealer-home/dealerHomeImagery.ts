/**
 * Curated furniture photography for /dev dealer-home galleries only.
 * Production dealer home builds tiles from live catalog products.
 */

export type DealerHomeCollection = {
  id: string;
  /** i18n key under mobile.dealerHome.collections.* — used by /dev galleries. */
  titleKey: string;
  /** Live category name from the API; preferred over titleKey when set. */
  title?: string;
  imageUrl: string;
  itemCount: number;
};

export const DEALER_HOME_COLLECTIONS: DealerHomeCollection[] = [
  {
    id: 'modern',
    titleKey: 'modern',
    imageUrl:
      'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=800&q=80',
    itemCount: 24,
  },
  {
    id: 'classic',
    titleKey: 'classic',
    imageUrl:
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80',
    itemCount: 18,
  },
  {
    id: 'dining',
    titleKey: 'dining',
    imageUrl:
      'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80',
    itemCount: 14,
  },
  {
    id: 'bedroom',
    titleKey: 'bedroom',
    imageUrl:
      'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80',
    itemCount: 22,
  },
];
