import { localizedName } from '@maher/i18n';
import type { SalesOrderDetail, SalesOrderLineItem } from './api';
import type { OrdersListVariant } from './selectOrderCard';

export type OrderGalleryImage = {
  key: string;
  uri: string;
  label?: string;
};

export type OrderLineItemView = {
  id: string;
  productName: string;
  description: string | null;
  quantity: number | null;
  dimensions: string | null;
  material: string | null;
  fabricType: string | null;
  fabricColor: string | null;
  woodType: string | null;
  foamDensity: string | null;
  finish: string | null;
  accessories: string | null;
  notes: string | null;
};

export type OrderCostMaterial = {
  key: 'fabric' | 'wood' | 'foam' | 'accessories';
  qty: number | null;
  cost: number | null;
};

export type OrderStageView = {
  code: string;
  name: string;
  status: string;
  progressPercent: number;
  dependsOnCodes: string[];
  sortOrder: number;
};

export type OrderProductionOrderView = {
  id: string;
  number: string;
  status: string;
  progressPercent: number | null;
  stages: OrderStageView[];
};

export type OrderDetailViewModel = {
  id: string;
  number: string;
  status: string;
  priority: string;
  title: string | null;
  notes: string | null;
  customerRef: string | null;
  dealerName: string | null;
  dealerPhone: string | null;
  dealerFax: string | null;
  projectName: string | null;
  deliveryDate: string | null;
  deliveryAddress: string | null;
  progressPercent: number;
  progressLabel?: string;
  requestSource: string | null;
  sellerPrice: number | null;
  manufacturingCost: number | null;
  profit: number | null;
  costBreakdown: Record<string, number | string | null> | null;
  costMaterials: OrderCostMaterial[];
  endCustomerName: string | null;
  endCustomerPhone: string | null;
  endCustomerFax: string | null;
  phone: string | null;
  fax: string | null;
  fabricSummary: string | null;
  assignedWorkerName: string | null;
  items: OrderLineItemView[];
  translatedText: string | null;
  originalText: string | null;
  detectedLanguage: string | null;
  targetLanguage: string | null;
  stages: OrderStageView[];
  productionOrders: OrderProductionOrderView[];
  documents: {
    id: string;
    fileName: string;
    mimeType: string | null;
    isImage: boolean;
  }[];
  invoices: {
    id: string;
    number: string;
    status: string;
    total: number | null;
  }[];
  deliveries: {
    id: string;
    number: string;
    status: string;
    deliveryDate: string | null;
  }[];
  returns: {
    id: string;
    number: string;
    status: string;
    reason: string | null;
    productDesc: string | null;
  }[];
  /** Product + public image URLs only; document images resolved separately. */
  heroImageUrls: string[];
  isDraft: boolean;
  showCosts: boolean;
  showStages: boolean;
  showEndCustomer: boolean;
  showWorker: boolean;
  canEdit: boolean;
};

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isImageMime(mime: string | null | undefined, fileName: string): boolean {
  if (mime?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|heic)$/i.test(fileName);
}

function dealerName(order: SalesOrderDetail, locale: string): string | null {
  const c = order.customer;
  if (!c) return null;
  const name = localizedName(locale, c, '');
  return name || null;
}

function fabricSummary(order: SalesOrderDetail): string | null {
  const items = orderItems(order);
  const parts: string[] = [];
  for (const item of items) {
    const bits = [item.fabricType, item.fabricColor, item.fabricCode]
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
    if (bits.length) parts.push(bits.join(' · '));
  }
  return parts.length ? parts.join('; ') : null;
}

function orderItems(order: SalesOrderDetail): SalesOrderLineItem[] {
  const reqItems = order.customerRequest?.items;
  if (reqItems?.length) return reqItems;
  return order.orderedItems ?? [];
}

function dim(item: SalesOrderLineItem): string | null {
  const parts = [item.width, item.height, item.depth]
    .map((v) => (v != null && String(v) !== '' ? String(v) : null))
    .filter(Boolean);
  return parts.length ? parts.join(' × ') : null;
}

function mapItems(order: SalesOrderDetail): OrderLineItemView[] {
  return orderItems(order).map((item) => ({
    id: item.id,
    productName: item.productName,
    description: item.description ?? null,
    quantity: toNumber(item.quantity),
    dimensions: dim(item),
    material: item.material ?? null,
    fabricType: item.fabricType ?? null,
    fabricColor: item.fabricColor ?? null,
    woodType: item.woodType ?? null,
    foamDensity: item.foamDensity ?? null,
    finish: item.finish ?? null,
    accessories: item.accessories ?? null,
    notes: item.notes ?? null,
  }));
}

function mapCostMaterials(
  breakdown: Record<string, number | string | null> | null | undefined,
): OrderCostMaterial[] {
  const cb = breakdown ?? {};
  return (
    [
      ['fabric', 'fabricQty', 'fabricCost'],
      ['wood', 'woodQty', 'woodCost'],
      ['foam', 'foamQty', 'foamCost'],
      ['accessories', 'accessoriesQty', 'accessoriesCost'],
    ] as const
  ).map(([key, qtyKey, costKey]) => ({
    key,
    qty: toNumber(cb[qtyKey]),
    cost: toNumber(cb[costKey]),
  }));
}

function mapStages(
  order: SalesOrderDetail,
  locale: string,
): { flat: OrderStageView[]; productionOrders: OrderProductionOrderView[] } {
  const productionOrders = (order.productionOrders ?? []).map((po) => ({
    id: po.id,
    number: po.number,
    status: po.status,
    progressPercent: po.progressPercent != null ? Number(po.progressPercent) : null,
    stages: (po.stages ?? []).map((s) => ({
      code: s.code,
      name: localizedName(locale, s, s.code),
      status: s.status,
      progressPercent: Number(s.progressPercent ?? 0),
      dependsOnCodes: s.dependsOnCodes ?? [],
      sortOrder: s.sortOrder,
    })),
  }));
  const flat = productionOrders.flatMap((po) => po.stages);
  return { flat, productionOrders };
}

/** Active floor stage name from the PO driving rollup progress. */
function progressLabelFromProductionOrders(
  productionOrders: OrderProductionOrderView[],
): string | undefined {
  if (!productionOrders.length) return undefined;
  const po = productionOrders.reduce((best, cur) =>
    Number(cur.progressPercent ?? 0) > Number(best.progressPercent ?? 0) ? cur : best,
  );
  const stages = po.stages ?? [];
  if (!stages.length) return undefined;

  const inProgress = stages.find((s) => s.status === 'IN_PROGRESS');
  if (inProgress?.name) return inProgress.name;

  const ready = stages.find((s) => s.status === 'READY');
  if (ready?.name) return ready.name;

  const partial = [...stages]
    .filter(
      (s) =>
        s.status !== 'COMPLETED' &&
        s.status !== 'SKIPPED' &&
        Number(s.progressPercent) > 0,
    )
    .sort((a, b) => Number(b.progressPercent) - Number(a.progressPercent))[0];
  if (partial?.name) return partial.name;

  const next = [...stages]
    .filter((s) => s.status !== 'COMPLETED' && s.status !== 'SKIPPED')
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return next?.name || undefined;
}

/**
 * Map API detail → role-safe view model.
 * Field fallbacks mirror admin-web sales-orders/[id] page.
 * Dealer gets stage DAG for workflow map but never costs, worker, or end-customer PII.
 */
export function selectOrderDetail(
  order: SalesOrderDetail,
  variant: OrdersListVariant,
  locale = 'en',
): OrderDetailViewModel {
  const isAdmin = variant === 'admin';
  const isDraft = order.status === 'DRAFT';
  const { flat: stages, productionOrders } = mapStages(order, locale);

  const docs = order.customerRequest?.documents ?? [];
  const photos = isAdmin
    ? (order.productionOrders ?? []).flatMap((po) => po.photos ?? [])
    : [];
  const allDocs = [...docs, ...photos];
  const seen = new Set<string>();
  const documents = allDocs
    .filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    })
    .map((d) => ({
      id: d.id,
      fileName: d.fileName,
      mimeType: d.mimeType,
      isImage: isImageMime(d.mimeType, d.fileName),
    }));

  const heroImageUrls = order.imageUrl ? [order.imageUrl] : [];

  const seller =
    toNumber(order.sellerPrice) ?? toNumber(order.total);
  const production =
    toNumber(order.productionPrice) ?? toNumber(order.manufacturingCost);
  const profit =
    toNumber(order.profit) ??
    (seller != null && production != null ? seller - production : null);

  const deliveryDate =
    order.requiredDeliveryDate ??
    order.requestedDeliveryDate ??
    order.customerRequest?.requiredDeliveryDate ??
    null;

  const deliveryAddress =
    order.customerRequest?.deliveryAddress ?? order.deliveryAddress ?? null;

  const projectName =
    order.customerRequest?.projectName ?? order.projectName ?? null;

  const customerRef =
    order.externalOrderNumber?.trim() ||
    order.customerRequest?.externalOrderNumber?.trim() ||
    null;

  const endCustomerPhone = order.customerRequest?.endCustomerPhone ?? null;
  const endCustomerFax = order.customerRequest?.endCustomerFax ?? null;
  const dealerPhone = order.customer?.phone ?? null;
  const dealerFax = order.customer?.fax ?? null;

  const translatedText =
    order.customerRequest?.translatedText ??
    order.customerRequest?.notes ??
    null;
  const originalText = order.customerRequest?.originalText ?? null;

  const base = {
    id: order.id,
    number: order.number,
    status: order.status,
    priority: order.priority,
    title: order.title,
    notes: order.notes ?? order.customerRequest?.notes ?? null,
    customerRef,
    dealerName: dealerName(order, locale),
    dealerPhone: isAdmin ? dealerPhone : null,
    dealerFax: isAdmin ? dealerFax : null,
    projectName: isAdmin ? projectName : projectName,
    deliveryDate,
    deliveryAddress,
    progressPercent: Number(order.progressPercent ?? 0),
    progressLabel: isAdmin
      ? (order.currentStage
          ? localizedName(locale, order.currentStage, '') || undefined
          : undefined) ||
        progressLabelFromProductionOrders(productionOrders) ||
        order.progressLabel
      : order.progressLabel,
    requestSource: order.customerRequest?.source ?? null,
    sellerPrice: seller,
    fabricSummary: fabricSummary(order),
    items: mapItems(order),
    translatedText: isAdmin ? translatedText : translatedText,
    originalText: isAdmin ? originalText : null,
    detectedLanguage: isAdmin
      ? (order.customerRequest?.detectedLanguage ?? null)
      : null,
    targetLanguage: isAdmin
      ? (order.customerRequest?.targetLanguage ?? null)
      : null,
    documents,
    invoices: (order.invoices ?? []).map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      total: toNumber(inv.total),
    })),
    deliveries: isAdmin
      ? (order.deliveries ?? []).map((d) => ({
          id: d.id,
          number: d.number,
          status: d.status,
          deliveryDate: d.deliveryDate ?? null,
        }))
      : [],
    returns: (order.returns ?? []).map((r) => ({
      id: r.id,
      number: r.number,
      status: r.approvalStatus,
      reason: r.reason ?? null,
      productDesc: r.productDesc ?? null,
    })),
    heroImageUrls,
    isDraft,
    showCosts: isAdmin,
    showStages: isAdmin || productionOrders.some((po) => po.stages.length > 0),
    showEndCustomer: isAdmin,
    showWorker: isAdmin,
    canEdit: isAdmin && isDraft,
  };

  if (!isAdmin) {
    return {
      ...base,
      manufacturingCost: null,
      profit: null,
      costBreakdown: null,
      costMaterials: [],
      endCustomerName: null,
      endCustomerPhone: null,
      endCustomerFax: null,
      phone: null,
      fax: null,
      assignedWorkerName: null,
      stages,
      productionOrders,
      originalText: null,
      detectedLanguage: null,
      targetLanguage: null,
      deliveries: [],
      canEdit: false,
    };
  }

  return {
    ...base,
    manufacturingCost: production,
    profit,
    costBreakdown: order.costBreakdown ?? null,
    costMaterials: mapCostMaterials(order.costBreakdown),
    endCustomerName: order.customerRequest?.endCustomerName ?? null,
    endCustomerPhone,
    endCustomerFax,
    phone: endCustomerPhone ?? dealerPhone,
    fax: endCustomerFax ?? dealerFax,
    assignedWorkerName: order.assignedEmployee?.name ?? null,
    stages,
    productionOrders,
  };
}

/** Runtime guard used in unit tests — dealer VM must not leak factory-only fields. */
export function assertDealerDetailSafe(vm: OrderDetailViewModel): void {
  if (vm.showCosts || vm.showWorker || vm.showEndCustomer) {
    throw new Error('Dealer detail flags must hide costs/worker/end-customer');
  }
  if (vm.manufacturingCost != null || vm.profit != null || vm.costBreakdown) {
    throw new Error('Dealer detail leaked costs');
  }
  if (vm.assignedWorkerName) {
    throw new Error('Dealer detail leaked worker');
  }
  if (vm.endCustomerName || vm.endCustomerPhone || vm.endCustomerFax) {
    throw new Error('Dealer detail leaked end-customer PII');
  }
  if (vm.costMaterials.length > 0) {
    throw new Error('Dealer detail leaked cost materials');
  }
  if (vm.canEdit) {
    throw new Error('Dealer detail must not be editable');
  }
}
