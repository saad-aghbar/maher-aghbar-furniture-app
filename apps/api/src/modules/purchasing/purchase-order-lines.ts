import { BadRequestException } from '@nestjs/common';
import { normalizePurchaseOrderOrigin, type PurchaseOrderOrigin } from './purchase-order-origin';

export type PurchaseOrderLineInput = {
  description: string;
  quantity: number;
  unitPrice?: number;
  inventoryItemId?: string;
  unit?: string;
  warehouseId?: string | null;
  locationId?: string | null;
};

export type PreparedPurchaseOrderLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
  inventoryItemId?: string;
  warehouseId?: string;
  locationId?: string;
};

export function resolveLineWarehouse(
  line: { warehouseId?: string | null },
  headerWarehouseId?: string | null,
): string | undefined {
  return line.warehouseId?.trim() || headerWarehouseId?.trim() || undefined;
}

export function preparePurchaseOrderLines(
  lines: PurchaseOrderLineInput[],
  opts: {
    headerWarehouseId?: string | null;
    inventoryUnits?: Record<string, string>;
    requirePrice?: boolean;
  } = {},
): { lines: PreparedPurchaseOrderLine[]; subtotal: number; taxAmount: number; total: number } {
  if (!lines.length) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'At least one line is required.',
    });
  }
  const prepared = lines.map((l) => {
    if (opts.requirePrice !== false && l.unitPrice == null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'unitPrice is required on purchase order lines.',
      });
    }
    const quantity = Number(l.quantity);
    if (!(quantity > 0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Line quantity must be greater than zero.',
      });
    }
    const unitPrice = Number(l.unitPrice ?? 0);
    const lineTotal = quantity * unitPrice;
    const unit =
      l.unit?.trim() ||
      (l.inventoryItemId ? opts.inventoryUnits?.[l.inventoryItemId] : undefined) ||
      'pcs';
    const warehouseId = resolveLineWarehouse(l, opts.headerWarehouseId);
    return {
      description: l.description,
      quantity,
      unit,
      unitPrice,
      taxRate: 0.16,
      lineTotal: lineTotal * 1.16,
      inventoryItemId: l.inventoryItemId,
      warehouseId,
      locationId: l.locationId?.trim() || undefined,
    };
  });
  const subtotal = prepared.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxAmount = subtotal * 0.16;
  return { lines: prepared, subtotal, taxAmount, total: subtotal + taxAmount };
}

export type BatchOrderInput = {
  supplierId: string;
  warehouseId?: string | null;
  notes?: string;
  expectedDeliveryDate?: string | null;
  origin?: string | null;
  lines: PurchaseOrderLineInput[];
};

export function normalizeBatchOrders(orders: BatchOrderInput[]): Array<
  BatchOrderInput & { origin: PurchaseOrderOrigin }
> {
  if (!orders.length) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'At least one purchase order is required.',
    });
  }
  return orders.map((order) => {
    if (!order.supplierId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Each order needs a supplier.',
      });
    }
    return {
      ...order,
      origin: normalizePurchaseOrderOrigin(order.origin),
    };
  });
}
