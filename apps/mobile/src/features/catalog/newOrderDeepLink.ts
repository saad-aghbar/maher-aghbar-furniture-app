import type { Href, Router } from 'expo-router';

type NewOrderRouter = Pick<Router, 'navigate' | 'replace'> & {
  canDismiss?: () => boolean;
  dismissAll?: () => void;
};

/** Sticky PDP CTA → New Order with catalog product + qty, skip product step. */
export function newOrderHrefForProduct(
  productId: string,
  qty = 1,
  variantId?: string,
  extras?: { variantLabel?: string; variantSku?: string },
): Href {
  const q = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
  const id = encodeURIComponent(productId);
  const variant = variantId?.trim()
    ? `&variantId=${encodeURIComponent(variantId.trim())}`
    : '';
  const label = extras?.variantLabel?.trim()
    ? `&variantLabel=${encodeURIComponent(extras.variantLabel.trim())}`
    : '';
  const sku = extras?.variantSku?.trim()
    ? `&variantSku=${encodeURIComponent(extras.variantSku.trim())}`
    : '';
  return `/(app)/(customer)/(tabs)/new-order?productId=${id}&qty=${q}&fromCatalog=1${variant}${label}${sku}` as Href;
}

export type CatalogNewOrderParams = {
  productId: string;
  qty: string;
  fromCatalog: '1';
  variantId?: string;
  variantLabel?: string;
  variantSku?: string;
};

export function catalogNewOrderParams(
  productId: string,
  qty = 1,
  variantId?: string,
  extras?: { variantLabel?: string; variantSku?: string },
): CatalogNewOrderParams {
  const q = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
  return {
    productId,
    qty: String(q),
    fromCatalog: '1',
    ...(variantId?.trim() ? { variantId: variantId.trim() } : {}),
    ...(extras?.variantLabel?.trim() ? { variantLabel: extras.variantLabel.trim() } : {}),
    ...(extras?.variantSku?.trim() ? { variantSku: extras.variantSku.trim() } : {}),
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
  variantId?: string,
  extras?: { variantLabel?: string; variantSku?: string },
): void {
  const params = catalogNewOrderParams(productId, qty, variantId, extras);
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

export function parseDeepLinkVariantId(
  variantId: string | string[] | undefined,
): string {
  const raw = Array.isArray(variantId) ? variantId[0] : variantId;
  return raw?.trim() ?? '';
}

export function parseDeepLinkText(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? '';
}

export function navigateToBasketReview(router: NewOrderRouter): void {
  const href = {
    pathname: '/(app)/(customer)/(tabs)/basket' as const,
  };
  if (typeof router.canDismiss === 'function' && router.canDismiss()) {
    router.dismissAll?.();
    router.navigate(href);
    return;
  }
  router.navigate(href);
}

export function navigateToCreateOrder(router: NewOrderRouter): void {
  const href = {
    pathname: '/(app)/(customer)/(tabs)/new-order' as const,
  };
  if (typeof router.canDismiss === 'function' && router.canDismiss()) {
    router.dismissAll?.();
    router.navigate(href);
    return;
  }
  router.navigate(href);
}
