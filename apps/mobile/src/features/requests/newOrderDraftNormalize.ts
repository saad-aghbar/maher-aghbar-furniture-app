import type { RequestPriority } from '@/api/modules/requests';
import type { NewOrderStep } from './newOrderSteps';
import { migrateDraftStep } from './newOrderSteps';
import { parseMapCoord } from '@/components/maps/mapCoords';
import {
  emptyDimensionFields,
  migrateLegacyDimensionsNotes,
  type NewOrderCustomMeasurement,
} from './newOrderMeasurements';
import {
  emptyOrderLine,
  lineFromLegacyDraft,
  normalizeOrderLine,
  type NewOrderLine,
} from './newOrderLine';

export type NewOrderLocalDraft = {
  version: 1 | 2 | 3 | 4;
  step: NewOrderStep;
  lines: NewOrderLine[];
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

function firstLineAliases(lines: NewOrderLine[]) {
  const first = lines[0] ?? emptyOrderLine();
  return {
    productId: first.productId,
    customProductName: first.customProductName,
    quantity: first.quantity,
    fabric: first.fabrics[0]?.type ?? '',
    fabricDescription: first.fabrics[0]?.notes ?? '',
    dimensionsNotes: first.dimensionsNotes,
    dimWidth: first.dimWidth,
    dimHeight: first.dimHeight,
    dimDepth: first.dimDepth,
    dimSeat: first.dimSeat,
    customMeasurements: first.customMeasurements,
  };
}

export function normalizeLocalDraft(
  parsed: Partial<NewOrderLocalDraft> & { step?: number; version?: number },
): NewOrderLocalDraft | null {
  const version = Number(parsed?.version);
  if (![1, 2, 3, 4].includes(version)) {
    return null;
  }
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

  const fromLines = Array.isArray(parsed.lines)
    ? parsed.lines.map((row, i) => normalizeOrderLine(row, i)).filter((row): row is NewOrderLine => Boolean(row))
    : [];
  const lines =
    fromLines.length > 0
      ? fromLines
      : [
          lineFromLegacyDraft({
            productId: String(parsed.productId ?? ''),
            customProductName: String(parsed.customProductName ?? ''),
            quantity: String(parsed.quantity ?? '1'),
            fabric: String(parsed.fabric ?? ''),
            fabricDescription: String(parsed.fabricDescription ?? ''),
            dimWidth,
            dimHeight,
            dimDepth,
            dimSeat,
            customMeasurements,
            dimensionsNotes,
          }),
        ];
  const aliases = firstLineAliases(lines);

  return {
    version: 4,
    step,
    lines,
    productId: aliases.productId,
    customProductName: aliases.customProductName,
    quantity: aliases.quantity,
    externalOrderNumber: String(parsed.externalOrderNumber ?? ''),
    priority: (parsed.priority as RequestPriority) || 'NORMAL',
    fabric: aliases.fabric,
    fabricDescription: aliases.fabricDescription,
    dimensionsNotes: aliases.dimensionsNotes,
    dimWidth: aliases.dimWidth,
    dimHeight: aliases.dimHeight,
    dimDepth: aliases.dimDepth,
    dimSeat: aliases.dimSeat,
    customMeasurements: aliases.customMeasurements,
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
