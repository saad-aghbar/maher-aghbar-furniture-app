import { localizedName } from '@maher/i18n';
import type { BrowseProduct } from '@/features/catalog/api';
import type { DealerHomeCollection } from './dealerHomeImagery';

function productImage(product: BrowseProduct): string | null {
  const uri =
    product.thumbnailUrl?.trim() ||
    product.imageUrl?.trim() ||
    product.galleryUrls?.find((u) => u?.trim())?.trim();
  return uri || null;
}

/** Group live browse products into collection tiles. No image → skip. */
export function collectionsFromProducts(
  products: BrowseProduct[],
  locale: string,
): DealerHomeCollection[] {
  const groups = new Map<
    string,
    { title: string; titleKey: string; imageUrl: string; itemCount: number }
  >();

  for (const product of products) {
    const cat = product.category;
    const image = productImage(product);
    if (!cat || !image) continue;
    const existing = groups.get(cat.id);
    if (existing) {
      existing.itemCount += 1;
      continue;
    }
    groups.set(cat.id, {
      title: localizedName(locale, cat, cat.nameEn),
      titleKey: cat.code.toLowerCase(),
      imageUrl: image,
      itemCount: 1,
    });
  }

  return [...groups.entries()].map(([id, group]) => ({
    id,
    title: group.title,
    titleKey: group.titleKey,
    imageUrl: group.imageUrl,
    itemCount: group.itemCount,
  }));
}
