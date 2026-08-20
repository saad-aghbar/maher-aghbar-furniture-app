import type { DealerHomeInvoice, DealerHomeOrder, DealerHomePayload } from './api';

export type MetricKey = 'activeOrders' | 'ordersInProduction' | 'ordersNearingDelivery';

export type MetricDef = {
  key: MetricKey;
  value: number;
};

/** @deprecated Prefer commerce carousels — kept for fixture/regression checks. */
export function metricStrip(data: DealerHomePayload): MetricDef[] {
  return [
    { key: 'activeOrders', value: data.activeOrders },
    { key: 'ordersInProduction', value: data.ordersInProduction },
    { key: 'ordersNearingDelivery', value: data.ordersNearingDelivery },
  ];
}

export function isDealerHomeEmpty(data: DealerHomePayload): boolean {
  return (
    data.activeOrders === 0 &&
    data.completedOrders === 0 &&
    data.recentOrders.length === 0 &&
    Number(data.outstandingBalance) === 0 &&
    data.recentInvoices.length === 0
  );
}

export function outstandingBalanceNumber(data: DealerHomePayload): number {
  const n = Number(data.outstandingBalance);
  return Number.isFinite(n) ? n : 0;
}

const NEAR_DELIVERY = new Set([
  'READY_FOR_DELIVERY',
  'READY',
  'OUT_FOR_DELIVERY',
]);

const ACTIVE = new Set([
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY_FOR_PRODUCTION',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
]);

/** Dealer-safe order card projection — no cost / worker fields. */
export type DealerHomeOrderCardModel = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  progressPercent: number;
  progressLabel: string | null;
  deliveryDate: string | null;
  /** True when `deliveryDate` reflects a scheduler-committed date (not just requested). */
  isCommittedDate: boolean;
  externalOrderNumber: string | null;
  endCustomerName: string | null;
};

/** Dealer-safe invoice card projection. */
export type DealerHomeInvoiceCardModel = {
  id: string;
  number: string;
  status: string;
  total: number;
  outstandingAmount: number;
  issuedAt: string;
  dueDate: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toDealerHomeOrderCard(order: DealerHomeOrder): DealerHomeOrderCardModel {
  const committed = order.committedDeliveryDate ?? null;
  const calendar = order.calendarDate ?? null;
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    title: order.title,
    imageUrl: order.imageUrl,
    progressPercent: Number(order.progressPercent ?? 0),
    progressLabel: order.progressLabel?.trim() || null,
    deliveryDate: calendar ?? committed ?? order.requiredDeliveryDate,
    isCommittedDate: Boolean(committed),
    externalOrderNumber: order.externalOrderNumber,
    endCustomerName: order.endCustomerName,
  };
}

export function toDealerHomeInvoiceCard(
  invoice: DealerHomeInvoice,
): DealerHomeInvoiceCardModel {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    total: toNumber(invoice.total),
    outstandingAmount: toNumber(invoice.outstandingAmount),
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
  };
}

const LEAK_KEYS = [
  'manufacturingCost',
  'profit',
  'costBreakdown',
  'workerName',
  'assignedWorker',
  'workerId',
  'basePrice',
] as const;

/** Runtime guard — dealer home cards must never carry cost/worker fields. */
export function assertDealerHomeOrderSafe(model: DealerHomeOrderCardModel): void {
  const keys = Object.keys(model);
  for (const leak of LEAK_KEYS) {
    if (keys.includes(leak)) {
      throw new Error(`Dealer home order leaked field: ${leak}`);
    }
  }
  const json = JSON.stringify(model);
  for (const leak of LEAK_KEYS) {
    if (json.includes(leak)) {
      throw new Error(`Dealer home order leaked field: ${leak}`);
    }
  }
}

export function assertDealerHomeInvoiceSafe(model: DealerHomeInvoiceCardModel): void {
  const keys = Object.keys(model);
  for (const leak of LEAK_KEYS) {
    if (keys.includes(leak)) {
      throw new Error(`Dealer home invoice leaked field: ${leak}`);
    }
  }
}

export function mapDealerHomeOrders(
  orders: DealerHomeOrder[],
): DealerHomeOrderCardModel[] {
  return orders.map((o) => {
    const card = toDealerHomeOrderCard(o);
    assertDealerHomeOrderSafe(card);
    return card;
  });
}

export function mapDealerHomeInvoices(
  invoices: DealerHomeInvoice[],
): DealerHomeInvoiceCardModel[] {
  return invoices.map((inv) => {
    const card = toDealerHomeInvoiceCard(inv);
    assertDealerHomeInvoiceSafe(card);
    return card;
  });
}

export function selectActiveOrders(
  orders: DealerHomeOrderCardModel[],
): DealerHomeOrderCardModel[] {
  return orders.filter(
    (o) =>
      ACTIVE.has(o.status) ||
      (o.progressPercent > 0 && o.progressPercent < 100),
  );
}

export function selectNearDeliveryOrders(
  orders: DealerHomeOrderCardModel[],
): DealerHomeOrderCardModel[] {
  return orders.filter(
    (o) => NEAR_DELIVERY.has(o.status) || o.progressPercent >= 80,
  );
}

export function selectRecentOrders(
  orders: DealerHomeOrderCardModel[],
  limit = 8,
): DealerHomeOrderCardModel[] {
  return orders.slice(0, limit);
}
