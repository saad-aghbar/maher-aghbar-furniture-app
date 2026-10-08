import { emptyOrderLine, type NewOrderLine } from './newOrderLine';

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

export function lineHasProduct(line: NewOrderLine): boolean {
  return Boolean(line.productId.trim() || line.customProductName.trim());
}

export function appendBasketLine(lines: NewOrderLine[], line: NewOrderLine): NewOrderLine[] {
  if (!lines.some(lineHasProduct)) return [line];
  return [...lines.filter(lineHasProduct), line];
}

export function lineHasManufacturingDiffs(line: NewOrderLine): boolean {
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

export function basketLineKind(line: NewOrderLine): 'standard' | 'customized' | 'custom' {
  if (!line.productId.trim()) return 'custom';
  if (line.modifiedByDealer) return 'customized';
  return 'standard';
}

export function upsertBasketLine(lines: NewOrderLine[], line: NewOrderLine): NewOrderLine[] {
  if (lines.some((row) => row.id === line.id)) return patchBasketLine(lines, line.id, line);
  return appendBasketLine(lines, line);
}

function catalogPatch(pick: CatalogBasketPick): Partial<NewOrderLine> {
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

function withReseededDims(line: NewOrderLine, pick: CatalogBasketPick): NewOrderLine {
  if (lineHasManufacturingDiffs(line)) return line;
  return {
    ...line,
    dimWidth: pick.dimWidth ?? line.dimWidth,
    dimHeight: pick.dimHeight ?? line.dimHeight,
    dimDepth: pick.dimDepth ?? line.dimDepth,
    dimSeat: pick.dimSeat ?? line.dimSeat,
  };
}

/** Fill an empty basket, otherwise append. A second add of the same product is its own line. */
export function applyCatalogProductToBasket(lines: NewOrderLine[], pick: CatalogBasketPick): NewOrderLine[] {
  const patch = catalogPatch(pick);
  if (!lines.length) return [emptyOrderLine(withReseededDims(emptyOrderLine(patch), pick))];
  const first = lines[0];
  if (!first) return [emptyOrderLine(patch)];
  if (!lines.some(lineHasProduct)) {
    return [withReseededDims({ ...first, ...patch, id: first.id }, pick)];
  }
  return [...lines, withReseededDims(emptyOrderLine(patch), pick)];
}

export function patchBasketLine(
  lines: NewOrderLine[],
  id: string,
  next: NewOrderLine | Partial<NewOrderLine>,
): NewOrderLine[] {
  return lines.map((line) => (line.id === id ? { ...line, ...next, id: line.id } : line));
}

export function removeBasketLine(lines: NewOrderLine[], id: string): NewOrderLine[] {
  return lines.filter((line) => line.id !== id);
}

export function addEmptyBasketLine(lines: NewOrderLine[]): NewOrderLine[] {
  return [...lines, emptyOrderLine()];
}
