import { emptyOrderLine, type NewOrderLine } from './newOrderLine';

export type CatalogBasketPick = {
  productId: string;
  quantity: string;
  customProductName?: string;
  variantId?: string;
  variantSku?: string;
  variantLabel?: string;
};

export function lineHasProduct(line: NewOrderLine): boolean {
  return Boolean(line.productId.trim() || line.customProductName.trim());
}

/** Catalog / favorites / ordered picks append when the basket already has a product. */
export function applyCatalogProductToBasket(
  lines: NewOrderLine[],
  pick: CatalogBasketPick,
): NewOrderLine[] {
  const patch = {
    productId: pick.productId,
    quantity: pick.quantity || '1',
    customProductName: pick.customProductName ?? '',
    variantId: pick.variantId ?? '',
    variantSku: pick.variantSku ?? '',
    variantLabel: pick.variantLabel ?? '',
  };
  if (!lines.length) return [emptyOrderLine(patch)];
  const first = lines[0];
  if (!first) return [emptyOrderLine(patch)];
  if (!lines.some(lineHasProduct)) {
    return [{ ...first, ...patch, id: first.id }];
  }
  return [...lines, emptyOrderLine(patch)];
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
