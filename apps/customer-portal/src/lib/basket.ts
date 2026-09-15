export type BasketOption = {
  specOptionValueId: string;
  groupId?: string;
  groupCode?: string;
  code?: string;
  nameEn?: string;
  nameAr?: string;
  qty?: number;
  note?: string;
};

export type BasketFabric = {
  key: string;
  type: string;
  color: string;
  role: string;
  notes: string;
};

export type BasketMeasurement = {
  id: string;
  label: string;
  value: string;
  unit?: string;
};

export type BasketLine = {
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
  customMeasurements: BasketMeasurement[];
  dimensionsNotes: string;
  fabrics: BasketFabric[];
  woodType: string;
  woodColor: string;
  foamDensity: string;
  finish: string;
  accessories: string;
  orientation: string;
  options: BasketOption[];
  notes: string;
  photoDocumentIds: string[];
  primaryImageDocumentId: string;
  imageUrl: string;
  dealerPrice: string;
  modifiedByDealer: boolean;
};

export type CatalogBasketPick = {
  productId: string;
  quantity: string;
  customProductName?: string;
  variantId?: string;
  variantSku?: string;
  variantLabel?: string;
  dimWidth?: string;
  dimHeight?: string;
  dimDepth?: string;
  dimSeat?: string;
  imageUrl?: string;
  dealerPrice?: string;
  preferUpdate?: boolean;
};

const STORAGE_KEY = 'maher.dealer.basket.v1';

export function newBasketLineId(): string {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyBasketLine(partial: Partial<BasketLine> = {}): BasketLine {
  return {
    id: newBasketLineId(),
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
    fabrics: [{ key: newBasketLineId(), type: '', color: '', role: '', notes: '' }],
    woodType: '',
    woodColor: '',
    foamDensity: '',
    finish: '',
    accessories: '',
    orientation: '',
    options: [],
    notes: '',
    photoDocumentIds: [],
    primaryImageDocumentId: '',
    imageUrl: '',
    dealerPrice: '',
    modifiedByDealer: false,
    ...partial,
  };
}

export function lineHasProduct(line: BasketLine): boolean {
  return Boolean(line.productId.trim() || line.customProductName.trim());
}

export function lineHasManufacturingDiffs(line: BasketLine): boolean {
  return Boolean(
    line.modifiedByDealer ||
      line.woodType.trim() ||
      line.woodColor.trim() ||
      line.foamDensity.trim() ||
      line.finish.trim() ||
      line.accessories.trim() ||
      (line.orientation.trim() && line.orientation !== 'NONE') ||
      line.options.length ||
      line.notes.trim() ||
      line.customMeasurements.length,
  );
}

export function basketLineKind(line: BasketLine): 'standard' | 'customized' | 'custom' {
  if (!line.productId.trim()) return 'custom';
  if (line.modifiedByDealer) return 'customized';
  return 'standard';
}

export function appendBasketLine(lines: BasketLine[], line: BasketLine): BasketLine[] {
  if (!lines.some(lineHasProduct)) return [line];
  return [...lines.filter(lineHasProduct), line];
}

export function patchBasketLine(
  lines: BasketLine[],
  id: string,
  next: BasketLine | Partial<BasketLine>,
): BasketLine[] {
  return lines.map((line) => (line.id === id ? { ...line, ...next, id: line.id } : line));
}

export function removeBasketLine(lines: BasketLine[], id: string): BasketLine[] {
  return lines.filter((line) => line.id !== id);
}

function catalogPatch(pick: CatalogBasketPick): Partial<BasketLine> {
  return {
    productId: pick.productId,
    quantity: pick.quantity || '1',
    customProductName: pick.customProductName ?? '',
    variantId: pick.variantId ?? '',
    variantSku: pick.variantSku ?? '',
    variantLabel: pick.variantLabel ?? '',
    ...(pick.imageUrl != null ? { imageUrl: pick.imageUrl } : {}),
    ...(pick.dealerPrice != null ? { dealerPrice: pick.dealerPrice } : {}),
  };
}

function withReseededDims(line: BasketLine, pick: CatalogBasketPick): BasketLine {
  if (lineHasManufacturingDiffs(line)) return line;
  return {
    ...line,
    dimWidth: pick.dimWidth ?? line.dimWidth,
    dimHeight: pick.dimHeight ?? line.dimHeight,
    dimDepth: pick.dimDepth ?? line.dimDepth,
    dimSeat: pick.dimSeat ?? line.dimSeat,
  };
}

/**
 * One existing line for a product updates (STD → named variant, dims reseeded
 * unless manufacturing diffs). Several lines of that product append.
 */
export function applyCatalogProductToBasket(
  lines: BasketLine[],
  pick: CatalogBasketPick,
  opts?: { preferUpdate?: boolean },
): BasketLine[] {
  const preferUpdate = opts?.preferUpdate ?? Boolean(pick.preferUpdate);
  const patch = catalogPatch(pick);
  if (!lines.length) return [emptyBasketLine(withReseededDims(emptyBasketLine(patch), pick))];
  const first = lines[0];
  if (!first) return [emptyBasketLine(patch)];
  if (!lines.some(lineHasProduct)) {
    return [withReseededDims({ ...first, ...patch, id: first.id }, pick)];
  }
  if (preferUpdate) {
    const sameProduct = lines.filter((line) => line.productId === pick.productId);
    if (sameProduct.length === 1) {
      const target = sameProduct[0]!;
      return lines.map((line) => {
        if (line.id !== target.id) return line;
        return withReseededDims({ ...line, ...patch, id: line.id }, pick);
      });
    }
  }
  return [...lines, withReseededDims(emptyBasketLine(patch), pick)];
}

export function upsertBasketLine(lines: BasketLine[], line: BasketLine): BasketLine[] {
  if (lines.some((row) => row.id === line.id)) return patchBasketLine(lines, line.id, line);
  return appendBasketLine(lines, line);
}

export function loadBasketDraft(): BasketLine[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lines?: BasketLine[] };
    if (!Array.isArray(parsed.lines)) return null;
    return parsed.lines.map((line) => emptyBasketLine(line));
  } catch {
    return null;
  }
}

export function saveBasketDraft(lines: BasketLine[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, lines, updatedAt: new Date().toISOString() }),
  );
}

export function lineToRequestItem(line: BasketLine, untitled: string) {
  const fabrics = line.fabrics
    .map((row) => ({
      key: row.key,
      type: row.type.trim() || null,
      color: row.color.trim() || null,
      role: row.role.trim() || null,
      notes: row.notes.trim() || null,
    }))
    .filter((row) => row.type || row.color || row.role);
  const customMeasurements = [
    ...(line.dimSeat.trim() ? [{ label: 'Seat', value: line.dimSeat.trim() }] : []),
    ...line.customMeasurements
      .map((m) => ({ label: m.label.trim(), value: m.value.trim() }))
      .filter((m) => m.label && m.value),
  ];
  const num = (raw: string) => {
    const n = Number(raw.trim());
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    productId: line.productId.trim() || undefined,
    productName: line.customProductName.trim() || untitled,
    quantity: Math.max(1, Number(line.quantity) || 1),
    variantId: line.variantId.trim() || undefined,
    variantSku: line.variantSku.trim() || undefined,
    variantLabel: line.variantLabel.trim() || undefined,
    notes: line.notes.trim() || undefined,
    fabric: fabrics[0]?.type ?? undefined,
    color: fabrics[0]?.color ?? undefined,
    fabrics: fabrics.length ? fabrics : undefined,
    width: num(line.dimWidth),
    height: num(line.dimHeight),
    depth: num(line.dimDepth),
    customMeasurements: customMeasurements.length ? customMeasurements : undefined,
    woodType: line.woodType.trim() || undefined,
    woodColor: line.woodColor.trim() || undefined,
    foamDensity: line.foamDensity.trim() || undefined,
    finish: line.finish.trim() || undefined,
    accessories: line.accessories.trim() || undefined,
    orientation:
      line.orientation.trim() && line.orientation !== 'NONE' ? line.orientation.trim() : undefined,
    options: line.options.length
      ? line.options.map((opt) => ({
          ...(opt.specOptionValueId ? { specOptionValueId: opt.specOptionValueId } : {}),
          groupCode: opt.groupCode,
          code: opt.code,
          nameEn: opt.nameEn,
          nameAr: opt.nameAr,
          qty: opt.qty,
          note: opt.note,
        }))
      : undefined,
    photoDocumentIds: line.photoDocumentIds.filter(Boolean).length
      ? line.photoDocumentIds.filter(Boolean)
      : undefined,
    primaryImageDocumentId: line.primaryImageDocumentId.trim() || undefined,
  };
}
