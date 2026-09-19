export type BuilderLine = {
  inventoryItemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unit?: string;
  warehouseId?: string;
  locationId?: string;
  category?: string | null;
};

export function isFabricCategory(category?: string | null) {
  return String(category ?? '').toUpperCase() === 'FABRIC';
}

export function validatePurchaseBuilder(input: {
  supplierId?: string | null;
  lines: BuilderLine[];
}): 'supplier' | 'lines' | 'qty' | 'holding' | null {
  if (!input.supplierId) return 'supplier';
  if (input.lines.length === 0) return 'lines';
  if (input.lines.some((line) => !(Number(line.quantity) > 0))) return 'qty';
  if (input.lines.some((line) => isFabricCategory(line.category) && !line.locationId)) {
    return 'holding';
  }
  return null;
}

export function buildPurchaseOrderPayload(input: {
  supplierId: string;
  warehouseId?: string;
  notes?: string;
  expectedDeliveryDate?: string;
  origin?: string;
  lines: BuilderLine[];
}) {
  return {
    supplierId: input.supplierId,
    warehouseId: input.warehouseId || undefined,
    notes: input.notes || undefined,
    expectedDeliveryDate: input.expectedDeliveryDate || undefined,
    origin: input.origin ?? 'MANUAL',
    lines: input.lines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice) || 0,
      inventoryItemId: line.inventoryItemId,
      unit: line.unit,
      warehouseId: line.warehouseId || undefined,
      locationId: line.locationId || undefined,
    })),
  };
}

export function buildReceivePayload(
  lines: Array<{
    inventoryItemId: string;
    orderedQty: number;
    receiveNow: string;
    rejectedQty: string;
    warehouseId?: string;
    locationId?: string;
  }>,
) {
  return {
    lines: lines
      .filter((line) => Number(line.receiveNow) > 0)
      .map((line) => ({
        inventoryItemId: line.inventoryItemId,
        orderedQty: line.orderedQty,
        receivedQty: Number(line.receiveNow),
        rejectedQty: Number(line.rejectedQty) || 0,
        warehouseId: line.warehouseId || undefined,
        locationId: line.locationId || undefined,
      })),
  };
}
