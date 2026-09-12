import type { CreateRequestItemInput } from '@/api/modules/requests';
import {
  emptyDealerFabricRow,
  type DealerFabricRow,
} from './FabricSelectionsEditor';
import type { NewOrderCustomMeasurement } from './newOrderMeasurements';
import { parseDimNumber, toRequestCustomMeasurements } from './newOrderMeasurements';
import { clampOrderQuantity } from './newOrderProductKind';

export type NewOrderLineOption = {
  specOptionValueId: string;
  groupId?: string;
  groupCode?: string;
  code?: string;
  nameEn?: string;
  nameAr?: string;
  qty?: number;
  note?: string;
};

export type NewOrderLine = {
  id: string;
  productId: string;
  customProductName: string;
  variantId: string;
  variantSku: string;
  variantLabel: string;
  quantity: string;
  dimWidth: string;
  dimHeight: string;
  dimDepth: string;
  dimSeat: string;
  customMeasurements: NewOrderCustomMeasurement[];
  dimensionsNotes: string;
  fabrics: DealerFabricRow[];
  woodType: string;
  woodColor: string;
  foamDensity: string;
  finish: string;
  accessories: string;
  orientation: string;
  options: NewOrderLineOption[];
  notes: string;
};

export function newOrderLineId(): string {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyOrderLine(partial: Partial<NewOrderLine> = {}): NewOrderLine {
  return {
    id: newOrderLineId(),
    productId: '',
    customProductName: '',
    variantId: '',
    variantSku: '',
    variantLabel: '',
    quantity: '1',
    dimWidth: '',
    dimHeight: '',
    dimDepth: '',
    dimSeat: '',
    customMeasurements: [],
    dimensionsNotes: '',
    fabrics: [emptyDealerFabricRow()],
    woodType: '',
    woodColor: '',
    foamDensity: '',
    finish: '',
    accessories: '',
    orientation: '',
    options: [],
    notes: '',
    ...partial,
  };
}

export function lineFromLegacyDraft(parsed: {
  productId?: string;
  customProductName?: string;
  quantity?: string;
  fabric?: string;
  fabricDescription?: string;
  dimWidth?: string;
  dimHeight?: string;
  dimDepth?: string;
  dimSeat?: string;
  customMeasurements?: NewOrderCustomMeasurement[];
  dimensionsNotes?: string;
}): NewOrderLine {
  const fabric = String(parsed.fabric ?? '').trim();
  return emptyOrderLine({
    productId: String(parsed.productId ?? ''),
    customProductName: String(parsed.customProductName ?? ''),
    quantity: String(parsed.quantity ?? '1'),
    dimWidth: String(parsed.dimWidth ?? ''),
    dimHeight: String(parsed.dimHeight ?? ''),
    dimDepth: String(parsed.dimDepth ?? ''),
    dimSeat: String(parsed.dimSeat ?? ''),
    customMeasurements: Array.isArray(parsed.customMeasurements) ? parsed.customMeasurements : [],
    dimensionsNotes: String(parsed.dimensionsNotes ?? ''),
    fabrics: fabric
      ? [
          {
            ...emptyDealerFabricRow(),
            type: fabric,
            notes: String(parsed.fabricDescription ?? ''),
          },
        ]
      : [emptyDealerFabricRow()],
  });
}

export function normalizeOrderLine(raw: unknown, index: number): NewOrderLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name = String(row.customProductName ?? row.productName ?? '').trim();
  const productId = String(row.productId ?? '');
  if (!name && !productId) return null;
  const fabrics = Array.isArray(row.fabrics)
    ? (row.fabrics as DealerFabricRow[]).map((fab, i) => ({
        ...emptyDealerFabricRow(),
        ...fab,
        key: String(fab.key ?? `fab-${index}-${i}`),
      }))
    : [emptyDealerFabricRow()];
  const options = Array.isArray(row.options)
    ? (row.options as NewOrderLineOption[]).filter((opt) => opt?.specOptionValueId)
    : [];
  return emptyOrderLine({
    id: String(row.id ?? `line-${index}`),
    productId,
    customProductName: name,
    variantId: String(row.variantId ?? ''),
    variantSku: String(row.variantSku ?? ''),
    variantLabel: String(row.variantLabel ?? ''),
    quantity: String(row.quantity ?? '1'),
    dimWidth: String(row.dimWidth ?? ''),
    dimHeight: String(row.dimHeight ?? ''),
    dimDepth: String(row.dimDepth ?? ''),
    dimSeat: String(row.dimSeat ?? ''),
    customMeasurements: Array.isArray(row.customMeasurements)
      ? (row.customMeasurements as NewOrderCustomMeasurement[])
      : [],
    dimensionsNotes: String(row.dimensionsNotes ?? ''),
    fabrics: fabrics.length ? fabrics : [emptyDealerFabricRow()],
    woodType: String(row.woodType ?? ''),
    woodColor: String(row.woodColor ?? ''),
    foamDensity: String(row.foamDensity ?? ''),
    finish: String(row.finish ?? ''),
    accessories: String(row.accessories ?? ''),
    options,
    notes: String(row.notes ?? ''),
  });
}

export function applyOptionToLine(
  line: NewOrderLine,
  group: { id: string; code: string },
  value: { id: string; code: string; nameEn?: string; nameAr?: string } | null,
): NewOrderLine {
  const options = line.options.filter((opt) => opt.groupId !== group.id && opt.groupCode !== group.code);
  if (value) {
    options.push({
      specOptionValueId: value.id,
      groupId: group.id,
      groupCode: group.code,
      code: value.code,
      nameEn: value.nameEn,
      nameAr: value.nameAr,
    });
  }
  const next = { ...line, options };
  const code = value?.code ?? '';
  if (group.code === 'FOAM_DENSITY') next.foamDensity = code;
  if (group.code === 'WOOD_TYPE') next.woodType = code;
  if (group.code === 'WOOD_COLOR') next.woodColor = code;
  if (group.code === 'PAINT_COLOR' || group.code === 'FABRIC_FINISH') next.finish = code;
  if (group.code === 'LEG_TYPE' || group.code === 'PIPING_STYLE' || group.code === 'CUSHION_SIZE') {
    next.accessories = code;
  }
  return next;
}

export function lineToRequestItem(
  line: NewOrderLine,
  untitled: string,
  seatLabel: string,
): CreateRequestItemInput {
  const fabrics = line.fabrics
    .map((row) => ({
      key: row.key,
      type: row.type.trim() || null,
      color: row.color.trim() || null,
      role: row.role.trim() || null,
      code: row.code.trim() || null,
      quantity: row.quantity.trim() ? Number(row.quantity) : null,
      unit: 'm',
      notes: row.notes.trim() || null,
    }))
    .filter((row) => row.type || row.color || row.code || row.role);
  const customMeasurements = toRequestCustomMeasurements(
    {
      width: line.dimWidth,
      height: line.dimHeight,
      depth: line.dimDepth,
      seat: line.dimSeat,
      custom: line.customMeasurements,
    },
    seatLabel,
  );
  const options = line.options
    .filter((opt) => opt.specOptionValueId)
    .map((opt) => ({
      specOptionValueId: opt.specOptionValueId,
      groupCode: opt.groupCode,
      code: opt.code,
      nameEn: opt.nameEn,
      nameAr: opt.nameAr,
      qty: opt.qty,
      note: opt.note,
    }));
  return {
    productId: line.productId.trim() || undefined,
    productName: line.customProductName.trim() || untitled,
    quantity: clampOrderQuantity(line.quantity),
    variantId: line.variantId.trim() || undefined,
    variantSku: line.variantSku.trim() || undefined,
    variantLabel: line.variantLabel.trim() || undefined,
    notes: line.notes.trim() || undefined,
    fabric: fabrics[0]?.type ?? undefined,
    color: fabrics[0]?.color ?? undefined,
    fabrics: fabrics.length ? fabrics : undefined,
    width: parseDimNumber(line.dimWidth),
    height: parseDimNumber(line.dimHeight),
    depth: parseDimNumber(line.dimDepth),
    customMeasurements: customMeasurements.length ? customMeasurements : undefined,
    woodType: line.woodType.trim() || undefined,
    woodColor: line.woodColor.trim() || undefined,
    foamDensity: line.foamDensity.trim() || undefined,
    finish: line.finish.trim() || undefined,
    accessories: line.accessories.trim() || undefined,
    orientation:
      line.orientation.trim() && line.orientation !== 'NONE' ? line.orientation.trim() : undefined,
    options: options.length ? options : undefined,
  };
}
