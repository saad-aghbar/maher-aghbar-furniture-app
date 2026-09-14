import { localizedName } from '@maher/i18n';
import { formatIdentifier, formatPercent } from '@/i18n/format';
import type { Locale } from '@maher/types';
import type {
  SalesOrderListItem,
  SalesOrderProductionReadinessSummary,
  SalesOrderJourneyLogistics,
} from './api';
import type { AdminOrderLifecycle } from './adminOrderLifecycle';
import {
  classifyAdminOrderJourney,
  type JourneyAttention,
  type JourneyPrimaryCta,
  type JourneyReadiness,
} from './adminOrderJourney';
import { resolveOrderManufacturingKind, complexityBadgeKey } from './orderManufacturingKind';

export type OrdersListVariant = 'admin' | 'dealer';

export type OrderBasketItemModel = {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  imageUrl: string | null;
  complexity: 'standard' | 'modified' | 'custom';
  fact: string;
  productionOrderId: string | null;
  done: boolean;
};

/** Admin desk list card — basket rows plus journey chrome. */
export type OrderBasketBoardOrder = {
  id: string;
  number: string;
  status: string;
  deliveryStatus?: string | null;
  dealerName?: string | null;
  sellerPrice?: number | null;
  kind?: 'order' | 'rfq' | 'returnWork';
  quantity?: string | number | null;
  lifecycle?: AdminOrderLifecycle;
  attention?: JourneyAttention;
  primaryCta?: JourneyPrimaryCta;
  journeyReadiness?: JourneyReadiness;
  actionHint?: string | null;
  progressPercent?: number | null;
  progressLabel?: string | null;
  deliveryDate?: string | null;
  plannedStartDate?: string | null;
  items?: OrderBasketItemModel[];
  productionReadinessSummary?: SalesOrderProductionReadinessSummary | null;
  journeyLogistics?: SalesOrderJourneyLogistics | null;
};

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
  kind?: 'order' | 'rfq' | 'returnWork';
  /** Commercial line kind: standard | modified | custom (worst of lines). */
  manufacturingKind?: 'standard' | 'modified' | 'custom';
  items?: OrderBasketItemModel[];
  primaryProductionOrderId?: string | null;
  plannedStartDate?: string | null;
  journeyLogistics?: SalesOrderJourneyLogistics | null;
  hasReturn?: boolean;
  returnSummary?: {
    id: string;
    number: string;
    lifecycleState?: string | null;
  } | null;
  originKind?: 'RETURN_WORK' | 'REPLACEMENT';
  originalOrderNumber?: string | null;
  releasedToFactoryAt?: string | null;
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
  hasReturn?: boolean;
};

export function selectOrderBasketItems(
  item: SalesOrderListItem,
  locale: string,
): OrderBasketItemModel[] {
  const lines = item.lineStrip ?? [];
  const pos = item.productionOrders ?? [];
  return lines.map((line, index) => {
    const id = line.id?.trim() || `line-${index}`;
    const linked =
      pos.find((po) => po.salesOrderLineId && po.salesOrderLineId === line.id) ??
      (pos.length === 1 && lines.length === 1 ? pos[0] : undefined);
    const quantity = Number(line.quantity);
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const sku = line.sku?.trim() || null;
    const qtyFact = sku
      ? `${formatIdentifier(locale as Locale, sku)}  × ${qty}`
      : `× ${qty}`;
    const pct =
      linked?.progressPercent != null && Number.isFinite(Number(linked.progressPercent))
        ? Math.max(0, Math.min(100, Math.round(Number(linked.progressPercent))))
        : null;
    const status = String(linked?.status ?? '').toUpperCase();
    const done = status === 'COMPLETED' || pct === 100;
    const fact = pct != null ? formatPercent(locale as Locale, pct) : qtyFact;
    return {
      id,
      title: basketItemTitle(line, locale),
      sku,
      quantity: qty,
      imageUrl: line.imageUrl?.trim() || null,
      complexity: complexityBadgeKey(line.manufacturingComplexity),
      fact,
      productionOrderId: linked?.id?.trim() || null,
      done,
    };
  });
}

function basketItemTitle(
  line: NonNullable<SalesOrderListItem['lineStrip']>[number],
  locale: string,
): string {
  const named = localizedName(
    locale,
    { nameEn: line.nameEn ?? '', nameAr: line.nameAr ?? '', nameHe: line.nameHe ?? '' },
    '',
  ).trim();
  if (named && named !== '—') return named;
  if (line.description?.trim()) return line.description.trim();
  if (line.sku?.trim()) return line.sku.trim();
  return '—';
}

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
    releasedToFactory: Boolean(
      item.releasedToFactory ??
        (item.productionOrders ?? []).some((po) => Boolean(po.releasedToFactoryAt)),
    ),
    executionStarted: Boolean(
      item.executionStarted ??
        ((item.productionOrders ?? []).some(
          (po) =>
            Boolean(po.actualStartDate) ||
            [
              'IN_PROGRESS',
              'ON_HOLD',
              'QUALITY_CHECK',
              'READY_FOR_PACKAGING',
              'READY_FOR_DELIVERY',
              'COMPLETED',
            ].includes(String(po.status ?? '').toUpperCase()),
        ) ||
          String(item.status).toUpperCase() === 'IN_PRODUCTION'),
    ),
    productionReadinessSummary: item.productionReadinessSummary,
    progressPercent: item.progressPercent,
    currentStageLabel: progressLabel,
    hasPendingReturn: Boolean(item.hasPendingReturn),
  };
  const journey = classifyAdminOrderJourney(lifecycleInput);
  const serverBucket = item.journeyBucket;
  const lifecycle =
    serverBucket === 'preparing' ||
    serverBucket === 'ready_to_start' ||
    serverBucket === 'in_production' ||
    serverBucket === 'ready_to_ship' ||
    serverBucket === 'shipped' ||
    serverBucket === 'delivered'
      ? serverBucket
      : journey.journeyBucket;
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
    lifecycle,
    attention: journey.attention,
    primaryCta: journey.primaryCta,
    journeyReadiness: journey.readiness,
    actionHint:
      item.productionReadinessSummary?.actionHint ??
      (journey.attention ? journey.attention.reasonLabelKey : null),
    kind: 'order',
    manufacturingKind: resolveOrderManufacturingKind([item.manufacturingComplexity]),
    items: selectOrderBasketItems(item, locale),
    primaryProductionOrderId:
      item.productionReadinessSummary?.primaryProductionOrderId ??
      item.productionOrders?.[0]?.id ??
      null,
    plannedStartDate: null,
    journeyLogistics: item.journeyLogistics ?? null,
    hasReturn: Boolean(item.hasReturn),
    returnSummary: item.returnSummary ?? null,
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
    hasReturn: Boolean(item.hasReturn),
  };
}

export function assertDealerCardSafe(model: DealerOrderCardModel): void {
  const keys = Object.keys(model);
  if (keys.includes('manufacturingCost') || keys.includes('profit')) {
    throw new Error('Dealer card must not include cost/profit fields');
  }
}
