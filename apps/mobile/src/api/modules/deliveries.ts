import { apiGet, apiPost } from '../client';
import type { PaginatedResponse } from '@maher/types';

/** Dealer confirms physical receipt — commercial close (no inventory side effects). */
export function confirmDeliveryReceipt(deliveryId: string) {
  return apiPost(`/deliveries/${encodeURIComponent(deliveryId)}/confirm-receipt`, {});
}

export function findDeliveryForSalesOrder(salesOrderNumber: string) {
  return apiGet<{ data: Array<{ id: string; number: string; status: string }> }>(
    `/deliveries?q=${encodeURIComponent(salesOrderNumber)}&pageSize=5`,
  ).then((res) => res.data[0] ?? null);
}

export type DeliveryListItem = {
  id: string;
  number: string;
  status: string;
  deliveryAddress: string;
  deliveryDate?: string | null;
  notes?: string | null;
  customer?: {
    id: string;
    code?: string | null;
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  salesOrder?: {
    id: string;
    number: string;
    status?: string;
    projectName?: string | null;
    externalOrderNumber?: string | null;
  } | null;
  items?: Array<{ id: string; description: string; quantity: number | string }>;
  loadProgress?: { loaded: number; total: number };
  /** Primary product label for floor cards. */
  productTitle?: string | null;
  productNameEn?: string | null;
  productNameAr?: string | null;
  productNameHe?: string | null;
  /** Catalog / inventory hero image for the order. */
  imageUrl?: string | null;
};

export type DeliveryLoadPiece = {
  id: string;
  pieceIndex: number;
  label: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  loadedAt: string | null;
  loadedById: string | null;
};

export type DeliveryLoadProduct = {
  inventoryLotId: string;
  productNameEn: string;
  productNameAr: string | null;
  productNameHe: string | null;
  sku: string;
  imageUrl: string | null;
  lotQuantity: number;
  lotQrCode: string | null;
  warehouse: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
  };
  location: { id: string; code: string; name: string | null } | null;
  productionOrder: {
    id: string;
    number: string;
    productDescription: string;
    quantity: number;
  } | null;
  pieces: DeliveryLoadPiece[];
};

export type DeliveryLoadSheet = {
  id: string;
  number: string;
  status: string;
  deliveryAddress: string;
  deliveryDate: string | null;
  notes: string | null;
  driverId: string | null;
  customer: {
    id: string;
    code?: string | null;
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  };
  salesOrder: {
    id: string;
    number: string;
    status: string;
    projectName?: string | null;
    externalOrderNumber?: string | null;
    deliveryAddress?: string | null;
  } | null;
  loadProgress: { loaded: number; total: number };
  allLoaded: boolean;
  canDepart: boolean;
  products: DeliveryLoadProduct[];
};

export type ListMyDeliveriesParams = {
  scope?: 'open' | 'completed' | 'all';
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export function listMyDeliveries(params: ListMyDeliveriesParams = {}) {
  return apiGet<PaginatedResponse<DeliveryListItem>>(
    `/deliveries${qs({
      mine: true,
      scope: params.scope ?? 'open',
      status: params.status,
      q: params.q,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 40,
    })}`,
  );
}

export function getDeliveryLoadSheet(deliveryId: string) {
  return apiGet<DeliveryLoadSheet>(
    `/deliveries/${encodeURIComponent(deliveryId)}/load-sheet`,
  );
}

export function checkDeliveryLoadPiece(deliveryId: string, pieceId: string) {
  return apiPost<DeliveryLoadSheet>(
    `/deliveries/${encodeURIComponent(deliveryId)}/load-pieces/${encodeURIComponent(pieceId)}/check`,
    {},
  );
}

export function uncheckDeliveryLoadPiece(deliveryId: string, pieceId: string) {
  return apiPost<DeliveryLoadSheet>(
    `/deliveries/${encodeURIComponent(deliveryId)}/load-pieces/${encodeURIComponent(pieceId)}/uncheck`,
    {},
  );
}

export function departDelivery(deliveryId: string) {
  return apiPost<DeliveryLoadSheet>(
    `/deliveries/${encodeURIComponent(deliveryId)}/depart`,
    {},
  );
}
