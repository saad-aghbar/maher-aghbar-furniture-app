import { localizedName } from '@maher/i18n';

export type InvoiceLinePick = {
  description: string;
  unitPrice: string;
  taxPercent: string;
  quantity?: string;
};

function moneyOrEmpty(raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.round(n * 1000) / 1000);
}

export function catalogProductToLinePick(
  product: {
    sku?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    price?: number | string | null;
    dealerPrice?: number | string | null;
    basePrice?: number | string | null;
  },
  locale: string,
): InvoiceLinePick {
  const description =
    localizedName(
      locale,
      { nameEn: product.nameEn, nameAr: product.nameAr, nameHe: product.nameHe },
      product.sku ?? '',
    ) ||
    product.sku ||
    'Item';
  return {
    description,
    unitPrice: moneyOrEmpty(product.dealerPrice ?? product.price ?? product.basePrice),
    taxPercent: '16',
  };
}

export function inventoryItemToLinePick(
  item: {
    sku?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    standardCost?: number | string | null;
  },
  locale: string,
): InvoiceLinePick {
  const description =
    localizedName(
      locale,
      { nameEn: item.nameEn, nameAr: item.nameAr, nameHe: item.nameHe },
      item.sku ?? '',
    ) ||
    item.sku ||
    'Item';
  return {
    description,
    unitPrice: moneyOrEmpty(item.standardCost),
    taxPercent: '0',
  };
}

export function customItemToLinePick(name: string, price: string, quantity = '1'): InvoiceLinePick {
  return {
    description: name.trim() || 'Item',
    unitPrice: moneyOrEmpty(price) || (price.trim() ? price.trim() : ''),
    taxPercent: '0',
    quantity,
  };
}

export type InvoiceLineDraft = {
  key: string;
  id?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxPercent: string;
  origin?: 'list' | 'custom';
};

export function applyInvoiceLinePick(
  lines: InvoiceLineDraft[],
  pick: InvoiceLinePick,
  editingKey: string | null,
): InvoiceLineDraft[] {
  const origin: InvoiceLineDraft['origin'] = pick.quantity != null ? 'custom' : 'list';
  if (editingKey) {
    return lines.map((row) =>
      row.key === editingKey
        ? {
            ...row,
            description: pick.description,
            unitPrice: pick.unitPrice,
            taxPercent: pick.taxPercent,
            quantity: pick.quantity ?? row.quantity,
            origin,
          }
        : row,
    );
  }
  return [
    ...lines,
    {
      key: `new-${Date.now()}`,
      description: pick.description,
      quantity: pick.quantity || '1',
      unitPrice: pick.unitPrice,
      taxPercent: pick.taxPercent,
      origin,
    },
  ];
}

export function invoiceEditErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
