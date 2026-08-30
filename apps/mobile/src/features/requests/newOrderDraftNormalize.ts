import type { RequestPriority } from '@/api/modules/requests';
import type { NewOrderStep } from './newOrderSteps';
import { migrateDraftStep } from './newOrderSteps';
import { parseMapCoord } from '@/components/maps/mapCoords';
import {
  emptyDimensionFields,
  migrateLegacyDimensionsNotes,
  type NewOrderCustomMeasurement,
} from './newOrderMeasurements';

export type NewOrderLocalDraft = {
  version: 1 | 2 | 3;
  step: NewOrderStep;
  productId: string;
  customProductName: string;
  quantity: string;
  externalOrderNumber: string;
  priority: RequestPriority;
  fabric: string;
  fabricDescription: string;
  dimensionsNotes: string;
  dimWidth: string;
  dimHeight: string;
  dimDepth: string;
  dimSeat: string;
  customMeasurements: NewOrderCustomMeasurement[];
  orderNotes: string;
  deliveryAddress: string;
  endCustomerName: string;
  endCustomerPhone: string;
  deliveryNotes: string;
  deliveryLat?: number;
  deliveryLng?: number;
  /** ISO date (yyyy-mm-dd) the dealer needs delivery by. Empty string = no preference. */
  requiredDeliveryDate: string;
  serverDraftId?: string;
  serverDraftNumber?: string;
  updatedAt: string;
};

function normalizeCustomRows(raw: unknown): NewOrderCustomMeasurement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const label = String(r.label ?? '').trim();
      const value = String(r.value ?? '').trim();
      if (!label && !value) return null;
      return {
        id: String(r.id ?? `m-${i}`),
        label,
        value,
      };
    })
    .filter((r): r is NewOrderCustomMeasurement => Boolean(r));
}

export function normalizeLocalDraft(
  parsed: Partial<NewOrderLocalDraft> & { step?: number; version?: number },
): NewOrderLocalDraft | null {
  if (parsed?.version !== 1 && parsed?.version !== 2 && parsed?.version !== 3) {
    return null;
  }
  const version = parsed.version;
  const step = migrateDraftStep(Number(parsed.step ?? 1), version);

  let dimWidth = String((parsed as { dimWidth?: string }).dimWidth ?? '');
  let dimHeight = String((parsed as { dimHeight?: string }).dimHeight ?? '');
  let dimDepth = String((parsed as { dimDepth?: string }).dimDepth ?? '');
  let dimSeat = String((parsed as { dimSeat?: string }).dimSeat ?? '');
  let customMeasurements = normalizeCustomRows(
    (parsed as { customMeasurements?: unknown }).customMeasurements,
  );
  const dimensionsNotes = String(parsed.dimensionsNotes ?? '');

  if (
    version < 3 &&
    !dimWidth &&
    !dimHeight &&
    !dimDepth &&
    !dimSeat &&
    customMeasurements.length === 0 &&
    dimensionsNotes.trim()
  ) {
    const migrated = migrateLegacyDimensionsNotes(dimensionsNotes);
    if (migrated) {
      dimWidth = migrated.width ?? '';
      dimHeight = migrated.height ?? '';
      dimDepth = migrated.depth ?? '';
      dimSeat = migrated.seat ?? '';
      customMeasurements = migrated.custom ?? [];
    }
  }

  return {
    version: 3,
    step,
    productId: String(parsed.productId ?? ''),
    customProductName: String(parsed.customProductName ?? ''),
    quantity: String(parsed.quantity ?? '1'),
    externalOrderNumber: String(parsed.externalOrderNumber ?? ''),
    priority: (parsed.priority as RequestPriority) || 'NORMAL',
    fabric: String(parsed.fabric ?? ''),
    fabricDescription: String(parsed.fabricDescription ?? ''),
    dimensionsNotes,
    dimWidth,
    dimHeight,
    dimDepth,
    dimSeat,
    customMeasurements,
    orderNotes: String(parsed.orderNotes ?? ''),
    deliveryAddress: String(parsed.deliveryAddress ?? ''),
    endCustomerName: String(parsed.endCustomerName ?? ''),
    endCustomerPhone: String(parsed.endCustomerPhone ?? ''),
    deliveryNotes: String(parsed.deliveryNotes ?? ''),
    deliveryLat: parseMapCoord(parsed.deliveryLat) ?? undefined,
    deliveryLng: parseMapCoord(parsed.deliveryLng) ?? undefined,
    requiredDeliveryDate: String(parsed.requiredDeliveryDate ?? ''),
    serverDraftId: parsed.serverDraftId,
    serverDraftNumber: parsed.serverDraftNumber,
    updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
  };
}

export { emptyDimensionFields };
