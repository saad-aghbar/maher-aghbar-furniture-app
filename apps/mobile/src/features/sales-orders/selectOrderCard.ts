import { localizedName } from '@maher/i18n';
import type {
  SalesOrderListItem,
  SalesOrderProductionReadinessSummary,
} from './api';
import type { AdminOrderLifecycle } from './adminOrderLifecycle';
import {
  classifyAdminOrderJourney,
  type JourneyAttention,
  type JourneyPrimaryCta,
  type JourneyReadiness,
} from './adminOrderJourney';

export type OrdersListVariant = 'admin' | 'dealer';

export type AdminOrderCardModel = {
  id: string;
  number: string;
  status: string;
  deliveryStatus?: string | null;
  priority: string;
  title: string;
  imageUrl: string | null;
  dealerId: string;
  dealerName: string;
  /** Null for RFQ — never invent fake progress. */
  progressPercent: number | null;
  /** Localized floor stage name when in production */
  progressLabel: string | null;
  deliveryDate: string | null;
  arrivedAt: string | null;
  externalOrderNumber: string | null;
  productionOrderNumbers: string[];
  manufacturingCost: number | null;
  sellerPrice: number | null;
  profit: number | null;
  quantity?: number | null;
  productionReadinessSummary?: SalesOrderProductionReadinessSummary | null;
  lifecycle?: AdminOrderLifecycle;
  attention?: JourneyAttention;
  primaryCta?: JourneyPrimaryCta;
  journeyReadiness?: JourneyReadiness;
  actionHint?: string | null;
  /** RFQ rows merged into admin Orders — look like normal orders in UI. */
  kind?: 'order' | 'rfq';
};

export type DealerOrderCardModel = {
  id: string;
  number: string;
  status: string;
  deliveryStatus?: string | null;
  title: string;
  imageUrl: string | null;
  progressPercent: number;
  progressLabel: string | null;
  deliveryDate: string | null;
  arrivedAt: string | null;
  externalOrderNumber: string | null;
  sellerPrice: number | null;
  kind?: 'order' | 'rfq';
  quantity?: string | number | null;
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
  const progressLabel = adminStageLabel(item, locale);
  const lifecycleInput = {
    status: item.status,
    deliveryStatus: item.deliveryStatus,
    requiredDeliveryDate: item.requiredDeliveryDate,
    isRfq: false,
    productionSetupRequired: Boolean(
      item.productionSetupRequired ??
        (String(item.status).toUpperCase() === 'DRAFT' &&
          (item.productionOrders?.length ?? 0) === 0),
    ),
    productionSetupStatus: item.productionSetupStatus ?? null,
    productionOrderCount:
      item.productionReadinessSummary?.productionOrderCount ??
      item.productionOrders?.length ??
      0,
    productionReadinessSummary: item.productionReadinessSummary,
    progressPercent: item.progressPercent,
    currentStageLabel: progressLabel,
  };
  const journey = classifyAdminOrderJourney(lifecycleInput);
  return {
    id: item.id,
    number: item.number,
    status: item.status,
    deliveryStatus: item.deliveryStatus ?? null,
    priority: item.priority,
    title: item.title ?? item.number,
    imageUrl: item.imageUrl,
    dealerId: item.customer?.id ?? '',
    dealerName: customerName(item, locale),
    progressPercent:
      item.progressPercent != null ? Number(item.progressPercent) : null,
    progressLabel,
    deliveryDate: item.requiredDeliveryDate,
    arrivedAt: item.createdAt ?? null,
    externalOrderNumber: item.externalOrderNumber ?? null,
    productionOrderNumbers: (item.productionOrders ?? [])
      .map((po) => po.number)
      .filter(Boolean),
    manufacturingCost: toNumber(item.manufacturingCost),
    sellerPrice: toNumber(item.sellerPrice),
    profit: toNumber(item.profit),
    quantity: item.lineCount != null ? Number(item.lineCount) : null,
    productionReadinessSummary: item.productionReadinessSummary ?? null,
    lifecycle: journey.journeyBucket,
    attention: journey.attention,
    primaryCta: journey.primaryCta,
    journeyReadiness: journey.readiness,
    actionHint:
      item.productionReadinessSummary?.actionHint ??
      (journey.attention ? journey.attention.reasonLabelKey : null),
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
