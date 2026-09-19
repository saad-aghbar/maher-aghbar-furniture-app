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

const JUNK_CATALOG_ROUTE_IDS = new Set(['customize', 'index', 'undefined', 'null']);

/** True when Expo treated a static segment as `catalog/[id]`. */
export function isJunkCatalogRouteId(value: string): boolean {
  return JUNK_CATALOG_ROUTE_IDS.has(value.trim().toLowerCase());
}

/**
 * Prefer an explicit `productId` query param. Ignore path `id` values that are
 * leftover static segments (`customize`) so Edit item never 404s the PDP.
 */
export function resolveCustomizeProductId(
  id: string | string[] | undefined,
  productId?: string | string[] | undefined,
): string {
  const fromQuery = parseDeepLinkProductId(productId);
  if (fromQuery && !isJunkCatalogRouteId(fromQuery)) return fromQuery;
  const fromPath = parseDeepLinkProductId(id);
  if (fromPath && !isJunkCatalogRouteId(fromPath)) return fromPath;
  return fromQuery;
}

/** First matching variant, else default, else first — never null when any exist. */
export function resolveSelectedVariant<T extends { id: string; isDefault?: boolean }>(
  variants: T[],
  variantId?: string | null,
): T | null {
  const wanted = variantId?.trim() ?? '';
  if (wanted) {
    const match = variants.find((row) => row.id === wanted);
    if (match) return match;
  }
  return variants.find((row) => row.isDefault) ?? variants[0] ?? null;
}

/**
 * Dealer PDP / Edit item → modify desk.
 * Lives next to `order/custom` so Expo does not parse `customize` as `catalog/[id]`.
 */
export function customizeVariantHref(
  productId: string,
  variantId: string,
  qty = 1,
  extras?: { lineId?: string },
): Href {
  const q = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
  return {
    pathname: '/(app)/(customer)/order/modify' as const,
    params: {
      productId: productId.trim(),
      variantId: variantId.trim(),
      qty: String(q),
      ...(extras?.lineId?.trim() ? { lineId: extras.lineId.trim() } : {}),
    },
  } as Href;
}

/** Dealer basket → custom piece desk (no catalog product, no dealer price). */
export function customItemHref(lineId?: string): Href {
  const q = lineId?.trim() ? `?lineId=${encodeURIComponent(lineId.trim())}` : '';
  return `/(app)/(customer)/order/custom${q}` as Href;
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
