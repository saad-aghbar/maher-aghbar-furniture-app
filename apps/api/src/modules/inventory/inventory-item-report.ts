import { inventoryScanPayload, printableScanCode } from '@maher/types';

export type InventoryItemReportStockStatus =
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'INACTIVE';

export type InventoryItemReportMovementType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'COUNT'
  | 'RETURN'
  | 'OTHER';

export type InventoryItemReportDto = {
  generatedAt: string;
  locale: 'en' | 'ar' | 'he';
  identity: {
    id: string;
    sku: string;
    scanCode: string;
    barcode: string | null;
    nameEn: string;
    nameAr: string;
    nameHe: string | null;
    description: string | null;
    category: string | null;
    materialType: string | null;
    color: string | null;
    size: string | null;
    unit: string;
    isActive: boolean;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
  };
  stock: {
    onHand: number;
    reserved: number;
    available: number;
    minStock: number;
    maxStock: number | null;
    incoming: number;
    status: InventoryItemReportStockStatus;
  };
  warehouses: Array<{
    warehouseId: string;
    code: string;
    name: string;
    onHand: number;
    reserved: number;
    available: number;
  }>;
  incoming: Array<{
    purchaseOrderId: string;
    purchaseOrderNumber: string;
    supplierName: string;
    orderedQty: number;
    receivedQty: number;
    remainingQty: number;
    unit: string;
    expectedDeliveryDate: string | null;
    status: string;
  }> | null;
  movements: {
    recent: Array<{
      id: string;
      number: string;
      date: string;
      type: InventoryItemReportMovementType;
      rawType: string;
      quantity: number;
      warehouseCode: string | null;
      warehouseName: string | null;
      referenceType: string | null;
      referenceId: string | null;
      notes: string | null;
      unitCost: number | null;
    }>;
    totalCount: number;
    shownCount: number;
    summary30d: {
      received: number;
      issued: number;
      transferred: number;
      adjusted: number;
      net: number;
    };
  };
  counts: Array<{
    number: string;
    date: string | null;
    status: string;
    warehouseCode: string | null;
    warehouseName: string | null;
    systemQty: number;
    countedQty: number | null;
    varianceQty: number | null;
  }> | null;
  demand: {
    status: string;
    requiredQty: number;
    freeQty: number;
    incomingQty: number;
    nextRequiredBy: string | null;
    nextEta: string | null;
    affected: Array<{
      productionOrderNumber: string;
      stageCode: string;
      qty: number;
      requiredBy: string | null;
    }>;
  } | null;
  products: Array<{
    productId: string;
    productName: string;
    productSku: string | null;
    stageCode: string | null;
    qtyPerUnit: number | null;
    quantityMode: string | null;
  }> | null;
  productionUsage: Array<{
    taskNumber: string;
    productionOrderNumber: string;
    expectedQty: number;
    actualQty: number | null;
    returnedQty: number;
    scrapQty: number;
    varianceQty: number | null;
    scrapReason: string | null;
    reasonNotes: string | null;
    finalizedAt: string | null;
    recordedBy: string | null;
  }> | null;
  supplier: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  cost: {
    standardCost: number;
    stockValue: number;
    reservedValue: number;
    availableValue: number;
  } | null;
  permissions: {
    canViewCost: boolean;
    canViewIncoming: boolean;
    canViewDemand: boolean;
  };
};

export function classifyInventoryItemStockStatus(args: {
  isActive: boolean;
  onHand: number;
  minStock: number;
}): InventoryItemReportStockStatus {
  if (!args.isActive) return 'INACTIVE';
  if (args.onHand <= 0) return 'OUT_OF_STOCK';
  if (args.onHand <= args.minStock) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export function mapInventoryTxType(
  type: string,
): InventoryItemReportMovementType {
  switch (type) {
    case 'PURCHASE_RECEIPT':
    case 'FINISHED_GOODS_RECEIPT':
    case 'SEMI_FINISHED_RECEIPT':
    case 'OPENING_BALANCE':
      return 'RECEIPT';
    case 'PRODUCTION_ISSUE':
    case 'DELIVERY_ISSUE':
    case 'SEMI_FINISHED_ISSUE':
    case 'DAMAGE':
    case 'SCRAP':
      return 'ISSUE';
    case 'WAREHOUSE_TRANSFER':
      return 'TRANSFER';
    case 'INVENTORY_ADJUSTMENT':
      return 'ADJUSTMENT';
    case 'CUSTOMER_RETURN':
    case 'PRODUCTION_RETURN':
    case 'DELIVERY_RESTORE':
      return 'RETURN';
    case 'SCRAP':
      return 'ISSUE';
    default:
      return 'OTHER';
  }
}

export function buildReportIdentity(item: {
  id: string;
  sku: string;
  qrCode?: string | null;
  barcode?: string | null;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  description?: string | null;
  category?: string | null;
  materialType?: string | null;
  color?: string | null;
  size?: string | null;
  unit: string;
  isActive: boolean;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const barcode = printableScanCode(item.barcode, '');
  return {
    id: item.id,
    sku: item.sku,
    scanCode: inventoryScanPayload(item),
    barcode: barcode || null,
    nameEn: item.nameEn,
    nameAr: item.nameAr,
    nameHe: item.nameHe ?? null,
    description: item.description?.trim() || null,
    category: item.category != null ? String(item.category) : null,
    materialType: item.materialType?.trim() || null,
    color: item.color?.trim() || null,
    size: item.size?.trim() || null,
    unit: item.unit,
    isActive: item.isActive,
    imageUrl: item.imageUrl?.trim() || null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
