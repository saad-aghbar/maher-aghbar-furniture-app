import type { CreateQuotationLineInput } from '@/api/modules/quotations';
import type { RequestItem } from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function positiveNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Map RFQ items onto CreateQuotation DTO lines.
 * Must not send unknown keys (`notes`) — API uses forbidNonWhitelisted.
 */
export function quotationLinesFromRequestItems(
  items: RequestItem[],
): CreateQuotationLineInput[] {
  return items.map((item) => {
    const quantity = positiveNumber(item.quantity) ?? 1;
    const description = (item.productName || item.description || 'Item').trim();
    const line: CreateQuotationLineInput = {
      description,
      quantity,
      unitPrice: 0,
      unit: item.unit?.trim() || 'pcs',
      taxRate: 0.16,
    };
    if (item.productId && UUID_RE.test(item.productId)) {
      line.productId = item.productId;
    }
    if (item.material?.trim()) line.material = item.material.trim();
    const fabric = (item.fabricType ?? item.fabric)?.trim();
    if (fabric) line.fabric = fabric;
    const color = (item.fabricColor ?? item.color)?.trim();
    if (color) line.color = color;
    const width = positiveNumber(item.width);
    const height = positiveNumber(item.height);
    const depth = positiveNumber(item.depth);
    if (width != null) line.width = width;
    if (height != null) line.height = height;
    if (depth != null) line.depth = depth;
    return line;
  });
}
