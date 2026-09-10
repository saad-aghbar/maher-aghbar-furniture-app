import { buildPurchaseOrderWhatsAppBody } from './fabric-whatsapp-copy';

export type PurchasingWhatsAppSettings = {
  template: string;
  includePrices: boolean;
  includeWarehouse: boolean;
  includeExpectedDate: boolean;
  signature: string;
};

export const PURCHASING_WHATSAPP_DEFAULTS: PurchasingWhatsAppSettings = {
  template: '',
  includePrices: false,
  includeWarehouse: false,
  includeExpectedDate: true,
  signature: '',
};

export function mergePurchasingWhatsAppSettings(
  value: unknown,
): PurchasingWhatsAppSettings {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    template: typeof raw.template === 'string' ? raw.template : PURCHASING_WHATSAPP_DEFAULTS.template,
    includePrices:
      typeof raw.includePrices === 'boolean'
        ? raw.includePrices
        : PURCHASING_WHATSAPP_DEFAULTS.includePrices,
    includeWarehouse:
      typeof raw.includeWarehouse === 'boolean'
        ? raw.includeWarehouse
        : PURCHASING_WHATSAPP_DEFAULTS.includeWarehouse,
    includeExpectedDate:
      typeof raw.includeExpectedDate === 'boolean'
        ? raw.includeExpectedDate
        : PURCHASING_WHATSAPP_DEFAULTS.includeExpectedDate,
    signature:
      typeof raw.signature === 'string' ? raw.signature : PURCHASING_WHATSAPP_DEFAULTS.signature,
  };
}

export type PurchaseWhatsAppLine = {
  description: string;
  quantity: unknown;
  unit?: string | null;
  unitPrice?: unknown;
  warehouseName?: string | null;
};

export type PurchaseWhatsAppContext = {
  supplierName: string;
  orderNumber: string;
  currency?: string | null;
  total?: unknown;
  expectedDate?: string | Date | null;
  companyName?: string | null;
  lines: PurchaseWhatsAppLine[];
};

const TOKEN_KEYS = [
  'supplierName',
  'orderNumber',
  'lines',
  'total',
  'currency',
  'expectedDate',
  'companyName',
  'signature',
] as const;
type PurchaseWhatsAppToken = (typeof TOKEN_KEYS)[number];

function formatQty(qty: unknown): string {
  const n = Number(qty);
  return Number.isFinite(n) ? String(n) : String(qty ?? '');
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

export function renderPurchaseWhatsAppLines(
  lines: PurchaseWhatsAppLine[],
  settings: PurchasingWhatsAppSettings,
): string {
  return lines
    .map((l) => {
      const qty = formatQty(l.quantity);
      const unit = l.unit?.trim() ? ` ${l.unit.trim()}` : '';
      const price =
        settings.includePrices && l.unitPrice != null && Number(l.unitPrice) > 0
          ? ` @ ${formatQty(l.unitPrice)}`
          : '';
      const warehouse =
        settings.includeWarehouse && l.warehouseName?.trim()
          ? ` → ${l.warehouseName.trim()}`
          : '';
      return `• ${l.description}: ${qty}${unit}${price}${warehouse}`;
    })
    .join('\n');
}

export function renderPurchaseWhatsAppTemplate(
  settings: PurchasingWhatsAppSettings,
  ctx: PurchaseWhatsAppContext,
): string {
  const template = settings.template.trim();
  if (!template) {
    return buildPurchaseOrderWhatsAppBody({
      number: ctx.orderNumber,
      lines: ctx.lines,
    });
  }
  const vars: Record<PurchaseWhatsAppToken, string> = {
    supplierName: ctx.supplierName ?? '',
    orderNumber: ctx.orderNumber ?? '',
    lines: renderPurchaseWhatsAppLines(ctx.lines, settings),
    total: formatQty(ctx.total ?? ''),
    currency: ctx.currency?.trim() || 'ILS',
    expectedDate: settings.includeExpectedDate ? formatDate(ctx.expectedDate) : '',
    companyName: ctx.companyName?.trim() || '',
    signature: settings.signature.trim(),
  };
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_all, key: string) => {
    return (TOKEN_KEYS as readonly string[]).includes(key) ? vars[key as PurchaseWhatsAppToken] : '';
  });
}
