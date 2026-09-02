/**
 * Presentation-safe logistics summary for Orders journey cards.
 * Canonical physical loading = DeliveryLoadPiece checklist (Piece 10).
 * Checking the last package ≠ Shipped — only explicit Confirm truck departed does.
 */

export type JourneyLoadStatus =
  /** FIN ready / pieces known, none checked onto truck yet. */
  | 'not_started'
  /** Delivery worker has checked some but not all packages. */
  | 'loading'
  /** All required packages checked; truck has NOT departed. */
  | 'fully_loaded'
  /** Explicit Confirm truck departed (OUT_FOR_DELIVERY). */
  | 'departed'
  /** Dealer confirmed receipt. */
  | 'delivered';

export type JourneyLogisticsSummary = {
  /** Package/load piece count when known; omit/null when unknown (never invent 0). */
  packageCount: number | null;
  packagesLoaded: number | null;
  packagesTotal: number | null;
  /** First unloaded piece index (1-based) when loading incomplete; else null. */
  firstMissingPackageIndex: number | null;
  /** True when FIN packages exist or SO/PO is ready for delivery; null if unknown. */
  finReady: boolean | null;
  finishedWarehouseName: string | null;
  finishedWarehouseCode: string | null;
  loadStatus: JourneyLoadStatus | null;
  deliveryId: string | null;
  deliveryNumber: string | null;
  /**
   * From AuditEvent delivery.depart (and legacy delivery.depart.auto for history only).
   * Never invent from updatedAt. Auto-depart is no longer a live path.
   */
  truckDepartedAt: string | null;
  dealerConfirmedAt: string | null;
  actualDeliveredAt: string | null;
  /** delivery.deliveryDate preferred; else SO requiredDeliveryDate. */
  committedDeliveryDate: string | null;
};

export type LogisticsDeliveryInput = {
  id: string;
  number: string;
  status: string;
  deliveryDate?: Date | string | null;
  customerConfirmedAt?: Date | string | null;
  actualDeliveredAt?: Date | string | null;
  loadPieces?: Array<{
    id: string;
    pieceIndex?: number | null;
    loadedAt?: Date | string | null;
    inventoryLot?: {
      warehouse?: {
        code?: string | null;
        nameEn?: string | null;
        nameAr?: string | null;
        nameHe?: string | null;
      } | null;
    } | null;
  }> | null;
};

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Build journey logistics from the latest delivery (+ optional depart audit time).
 * Load progress is derived only from DeliveryLoadPiece — not from SO status alone.
 */
export function buildJourneyLogisticsSummary(input: {
  delivery: LogisticsDeliveryInput | null | undefined;
  soRequiredDeliveryDate?: Date | string | null;
  soStatus?: string | null;
  poStatuses?: string[] | null;
  truckDepartedAt?: Date | string | null;
  localeWarehouseName?: 'en' | 'ar' | 'he';
}): JourneyLogisticsSummary | null {
  const delivery = input.delivery;
  if (!delivery) {
    const committed = iso(input.soRequiredDeliveryDate);
    if (!committed) return null;
    return {
      packageCount: null,
      packagesLoaded: null,
      packagesTotal: null,
      firstMissingPackageIndex: null,
      finReady: null,
      finishedWarehouseName: null,
      finishedWarehouseCode: null,
      loadStatus: null,
      deliveryId: null,
      deliveryNumber: null,
      truckDepartedAt: null,
      dealerConfirmedAt: null,
      actualDeliveredAt: null,
      committedDeliveryDate: committed,
    };
  }

  const pieces = [...(delivery.loadPieces ?? [])].sort(
    (a, b) => (a.pieceIndex ?? 0) - (b.pieceIndex ?? 0),
  );
  const hasPieces = pieces.length > 0;
  const loaded = hasPieces ? pieces.filter((p) => Boolean(p.loadedAt)).length : null;
  const total = hasPieces ? pieces.length : null;
  const packageCount = hasPieces ? pieces.length : null;
  const firstMissing = hasPieces
    ? pieces.find((p) => !p.loadedAt)
    : undefined;
  const firstMissingPackageIndex =
    firstMissing != null
      ? (firstMissing.pieceIndex != null && firstMissing.pieceIndex > 0
          ? firstMissing.pieceIndex
          : pieces.indexOf(firstMissing) + 1)
      : null;

  const status = String(delivery.status ?? '').toUpperCase();
  const poReady = (input.poStatuses ?? []).some(
    (s) => String(s).toUpperCase() === 'READY_FOR_DELIVERY',
  );
  const soReady = String(input.soStatus ?? '').toUpperCase() === 'READY_FOR_DELIVERY';
  const finReady = hasPieces ? true : poReady || soReady ? true : null;

  const warehouse = pieces.find((p) => p.inventoryLot?.warehouse)?.inventoryLot?.warehouse;
  const whLocale = input.localeWarehouseName ?? 'en';
  const finishedWarehouseName = warehouse
    ? whLocale === 'ar'
      ? warehouse.nameAr ?? warehouse.nameEn ?? null
      : whLocale === 'he'
        ? warehouse.nameHe ?? warehouse.nameEn ?? null
        : warehouse.nameEn ?? warehouse.nameAr ?? null
    : null;

  let loadStatus: JourneyLoadStatus | null = null;
  if (status === 'DELIVERED') {
    loadStatus = 'delivered';
  } else if (status === 'OUT_FOR_DELIVERY') {
    loadStatus = 'departed';
  } else if (hasPieces && loaded != null && total != null) {
    // Physical checklist only — never promote to departed from load completion.
    if (loaded === 0) loadStatus = 'not_started';
    else if (loaded < total) loadStatus = 'loading';
    else loadStatus = 'fully_loaded';
  } else if (status === 'READY' || status === 'PLANNED' || soReady) {
    loadStatus = hasPieces ? 'not_started' : null;
  }

  const truckDepartedAt =
    status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED'
      ? iso(input.truckDepartedAt)
      : null;

  return {
    packageCount,
    packagesLoaded: loaded,
    packagesTotal: total,
    firstMissingPackageIndex,
    finReady,
    finishedWarehouseName,
    finishedWarehouseCode: warehouse?.code ?? null,
    loadStatus,
    deliveryId: delivery.id,
    deliveryNumber: delivery.number,
    truckDepartedAt,
    dealerConfirmedAt: iso(delivery.customerConfirmedAt),
    actualDeliveredAt: iso(delivery.actualDeliveredAt),
    committedDeliveryDate:
      iso(delivery.deliveryDate) ?? iso(input.soRequiredDeliveryDate),
  };
}
