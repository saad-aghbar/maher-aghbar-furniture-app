export type NewOrderStep = 1 | 2 | 3 | 4;

/** Map legacy 6-step drafts onto the 4-step wizard. */
export function migrateDraftStep(step: number, version: number): NewOrderStep {
  const clamped = Math.min(Math.max(Math.floor(step) || 1, 1), 6);
  if (version >= 2) {
    return Math.min(4, Math.max(1, clamped)) as NewOrderStep;
  }
  const legacyMap: Record<number, NewOrderStep> = {
    1: 1,
    2: 2,
    3: 3,
    4: 2,
    5: 4,
    6: 4,
  };
  return legacyMap[clamped] ?? 1;
}

export function clampWizardStep(step: number): NewOrderStep {
  return Math.min(4, Math.max(1, Math.floor(step) || 1)) as NewOrderStep;
}

/** Fields that must survive navigation between steps (local draft shape). */
export type NewOrderPersistedFields = {
  productId: string;
  customProductName: string;
  quantity: string;
  externalOrderNumber: string;
  priority: string;
  fabric: string;
  fabricDescription: string;
  dimensionsNotes: string;
  orderNotes: string;
  deliveryAddress: string;
  endCustomerName: string;
  endCustomerPhone: string;
  deliveryNotes: string;
  deliveryLat?: number;
  deliveryLng?: number;
  requiredDeliveryDate: string;
};

export function pickPersistedFields<T extends NewOrderPersistedFields>(
  source: T,
): NewOrderPersistedFields {
  return {
    productId: source.productId,
    customProductName: source.customProductName,
    quantity: source.quantity,
    externalOrderNumber: source.externalOrderNumber,
    priority: source.priority,
    fabric: source.fabric,
    fabricDescription: source.fabricDescription,
    dimensionsNotes: source.dimensionsNotes,
    orderNotes: source.orderNotes,
    deliveryAddress: source.deliveryAddress,
    endCustomerName: source.endCustomerName,
    endCustomerPhone: source.endCustomerPhone,
    deliveryNotes: source.deliveryNotes,
    deliveryLat: source.deliveryLat,
    deliveryLng: source.deliveryLng,
    requiredDeliveryDate: source.requiredDeliveryDate,
  };
}
