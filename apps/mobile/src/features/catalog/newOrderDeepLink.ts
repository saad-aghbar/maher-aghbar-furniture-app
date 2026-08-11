import type { Href, Router } from 'expo-router';

type NewOrderRouter = Pick<Router, 'navigate' | 'replace'> & {
  canDismiss?: () => boolean;
  dismissAll?: () => void;
};

/** Sticky PDP CTA → New Order with catalog product + qty, skip product step. */
export function newOrderHrefForProduct(productId: string, qty = 1): Href {
  const q = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
  const id = encodeURIComponent(productId);
  return `/(app)/(customer)/(tabs)/new-order?productId=${id}&qty=${q}&fromCatalog=1` as Href;
}

export type CatalogNewOrderParams = {
  productId: string;
  qty: string;
  fromCatalog: '1';
};

export function catalogNewOrderParams(productId: string, qty = 1): CatalogNewOrderParams {
  const q = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
  return {
    productId,
    qty: String(q),
    fromCatalog: '1',
  };
}

/**
 * Leave the product-detail stack layer, then focus the New Order tab with params.
 * Query-string `push` from `catalog/[id]` often resets to Home; match tab navigation:
 * dismissAll (when nested) then navigate with pathname + params.
 */
export function navigateToNewOrderWithProduct(
  router: NewOrderRouter,
  productId: string,
  qty = 1,
): void {
  const params = catalogNewOrderParams(productId, qty);
  const href = {
    pathname: '/(app)/(customer)/(tabs)/new-order' as const,
    params,
  };

  if (typeof router.canDismiss === 'function' && router.canDismiss()) {
    router.dismissAll?.();
    router.navigate(href);
    return;
  }

  router.navigate(href);
}

/** True when New Order was opened from dealer catalog PDP. */
export function isCatalogOrderDeepLink(params: {
  productId?: string | string[];
  fromCatalog?: string | string[];
}): boolean {
  const productId = Array.isArray(params.productId)
    ? params.productId[0]
    : params.productId;
  if (!productId?.trim()) return false;
  const flag = Array.isArray(params.fromCatalog)
    ? params.fromCatalog[0]
    : params.fromCatalog;
  return flag === '1' || flag === 'true' || Boolean(productId.trim());
}

export function parseDeepLinkQty(qty: string | string[] | undefined): string {
  const raw = Array.isArray(qty) ? qty[0] : qty;
  const n = Math.max(1, Math.min(99, Math.floor(Number(raw) || 1)));
  return String(n);
}

export function parseDeepLinkProductId(
  productId: string | string[] | undefined,
): string {
  const raw = Array.isArray(productId) ? productId[0] : productId;
  return raw?.trim() ?? '';
}
