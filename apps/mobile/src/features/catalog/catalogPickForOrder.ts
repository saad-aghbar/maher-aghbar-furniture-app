import type { Href } from 'expo-router';

export const CATALOG_PICK_FOR_ORDER_PARAM = 'pickForOrder';

/** Open dealer Catalog tab to choose a product for New Order. */
export function catalogPickForOrderHref(): Href {
  return `/(app)/(customer)/(tabs)/catalog?${CATALOG_PICK_FOR_ORDER_PARAM}=1` as Href;
}

export function isCatalogPickForOrder(
  params: Record<string, string | string[] | undefined>,
): boolean {
  const raw = params[CATALOG_PICK_FOR_ORDER_PARAM];
  const flag = Array.isArray(raw) ? raw[0] : raw;
  return flag === '1' || flag === 'true';
}
