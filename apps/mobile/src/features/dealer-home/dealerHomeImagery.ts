/**
 * Curated furniture photography for dealer home collections.
 * Decorative only — metrics still come from live APIs.
 */

export type DealerHomeCollection = {
  id: string;
  /** i18n key under mobile.dealerHome.collections.* */
  titleKey: string;
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
