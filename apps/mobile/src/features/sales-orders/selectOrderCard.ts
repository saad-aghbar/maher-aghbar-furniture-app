import { localizedName } from '@maher/i18n';
import type { SalesOrderListItem } from './api';

export type OrdersListVariant = 'admin' | 'dealer';

export type AdminOrderCardModel = {
  id: string;
  number: string;
  status: string;
  priority: string;
  title: string;
  imageUrl: string | null;
  dealerId: string;
  dealerName: string;
  progressPercent: number;
  /** Localized floor stage name when in production */
  progressLabel: string | null;
  deliveryDate: string | null;
  arrivedAt: string | null;
  externalOrderNumber: string | null;
  productionOrderNumbers: string[];
  manufacturingCost: number | null;
  sellerPrice: number | null;
  profit: number | null;
  /** RFQ rows merged into admin Orders — look like normal orders in UI. */
  kind?: 'order' | 'rfq';
};

export type DealerOrderCardModel = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  progressPercent: number;
  progressLabel: string | null;
  deliveryDate: string | null;
  arrivedAt: string | null;
  externalOrderNumber: string | null;
  sellerPrice: number | null;
  kind?: 'order' | 'rfq';
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function customerName(item: SalesOrderListItem, locale: string): string {
  const c = item.customer;
  if (!c) return '—';
  return localizedName(locale, c, c.code || '—');
}

function adminStageLabel(item: SalesOrderListItem, locale: string): string | null {
  if (item.currentStage) {
    const name = localizedName(locale, item.currentStage, '');
    if (name) return name;
  }
  return item.progressLabel?.trim() || null;
}

export function toAdminOrderCard(
  item: SalesOrderListItem,
  locale = 'en',
): AdminOrderCardModel {
  return {
    id: item.id,
    number: item.number,
    status: item.status,
    priority: item.priority,
    title: item.title ?? item.number,
    imageUrl: item.imageUrl,
    dealerId: item.customer?.id ?? '',
    dealerName: customerName(item, locale),
    progressPercent: Number(item.progressPercent ?? 0),
    progressLabel: adminStageLabel(item, locale),
    deliveryDate: item.requiredDeliveryDate,
    arrivedAt: item.createdAt ?? null,
    externalOrderNumber: item.externalOrderNumber ?? null,
    productionOrderNumbers: (item.productionOrders ?? [])
      .map((po) => po.number)
      .filter(Boolean),
    manufacturingCost: toNumber(item.manufacturingCost),
    sellerPrice: toNumber(item.sellerPrice),
    profit: toNumber(item.profit),
    kind: 'order',
  };
}

/** Dealer projection — intentionally omits manufacturingCost / profit. */
export function toDealerOrderCard(item: SalesOrderListItem): DealerOrderCardModel {
  return {
    id: item.id,
    number: item.number,
    status: item.status,
    title: item.title ?? item.number,
    imageUrl: item.imageUrl,
    progressPercent: Number(item.progressPercent ?? 0),
    progressLabel: item.progressLabel?.trim() || null,
    deliveryDate: item.requiredDeliveryDate,
    arrivedAt: item.createdAt ?? null,
    externalOrderNumber: item.externalOrderNumber ?? null,
    sellerPrice: toNumber(item.sellerPrice),
  };
}

export function assertDealerCardSafe(model: DealerOrderCardModel): void {
  const keys = Object.keys(model);
  if (keys.includes('manufacturingCost') || keys.includes('profit')) {
    throw new Error('Dealer card must not include cost/profit fields');
  }
}
