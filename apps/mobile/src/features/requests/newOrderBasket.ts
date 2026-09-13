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

/**
 * Catalog / favorites / ordered picks append when the basket already has a product.
 * PDP passes `preferUpdate`: a single existing line for that product is updated
 * (and STANDARD dims reseeded) instead of appending.
 */
export function applyCatalogProductToBasket(
  lines: NewOrderLine[],
  pick: CatalogBasketPick,
  opts?: { preferUpdate?: boolean },
): NewOrderLine[] {
  const preferUpdate = opts?.preferUpdate ?? Boolean(pick.preferUpdate);
  const patch = catalogPatch(pick);
  if (!lines.length) return [emptyOrderLine(withReseededDims(emptyOrderLine(patch), pick))];
  const first = lines[0];
  if (!first) return [emptyOrderLine(patch)];
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
