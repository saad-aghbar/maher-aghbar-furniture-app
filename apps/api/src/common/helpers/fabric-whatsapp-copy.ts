export type FabricWhatsAppLocale = 'ar' | 'en';

type Copy = {
  fabricHeader: (orderNumber: string) => string;
  product: (name: string) => string;
  dealer: (name: string) => string;
  confirmAvailability: string;
  qtyTbc: string;
  thanks: string;
  poHeader: (number: string) => string;
  poPlease: string;
};

const COPY: Record<FabricWhatsAppLocale, Copy> = {
  ar: {
    fabricHeader: (orderNumber) => `طلب قماش لأمر ${orderNumber}`,
    product: (name) => `المنتج: ${name}`,
    dealer: (name) => `التاجر: ${name}`,
    confirmAvailability: 'يرجى تأكيد التوفر:',
    qtyTbc: 'الكمية لاحقاً',
    thanks: 'شكراً لكم.',
    poHeader: (number) => `أمر شراء ${number}`,
    poPlease: 'يرجى التوريد:',
  },
  en: {
    fabricHeader: (orderNumber) => `Fabric request for order ${orderNumber}`,
    product: (name) => `Product: ${name}`,
    dealer: (name) => `Dealer: ${name}`,
    confirmAvailability: 'Please confirm availability:',
    qtyTbc: 'qty TBC',
    thanks: 'Thank you.',
    poHeader: (number) => `Purchase order ${number}`,
    poPlease: 'Please supply:',
  },
};

function copyFor(locale?: FabricWhatsAppLocale | null): Copy {
  return locale === 'en' ? COPY.en : COPY.ar;
}

function lineQty(qty: number | null | undefined, tbc: string): string {
  return qty != null && Number.isFinite(qty) ? String(qty) : tbc;
}

/** Arabic default. Prefer nameAr at the call site. */
export function buildFabricProcurementWhatsAppBody(
  input: {
    orderNumber: string;
    productName?: string | null;
    dealerName?: string | null;
    lines: Array<{
      procurementId: string;
      label: string;
      role?: string | null;
      qty?: number | null;
      unit?: string | null;
    }>;
  },
  locale: FabricWhatsAppLocale = 'ar',
): string {
  const copy = copyFor(locale);
  const header = [copy.fabricHeader(input.orderNumber)];
  if (input.productName?.trim()) header.push(copy.product(input.productName.trim()));
  if (input.dealerName?.trim()) header.push(copy.dealer(input.dealerName.trim()));
  const lines = input.lines.map((l) => {
    const qty = lineQty(l.qty, copy.qtyTbc);
    const unit = l.unit?.trim() ? ` ${l.unit.trim()}` : '';
    const role = l.role?.trim() ? ` (${l.role.trim()})` : '';
    return `• ${l.label}${role}: ${qty}${unit} [${l.procurementId.slice(0, 8)}]`;
  });
  return `${header.join('\n')}\n${copy.confirmAvailability}\n${lines.join('\n')}\n${copy.thanks}`;
}

export function buildPurchaseOrderWhatsAppBody(
  po: {
    number: string;
    lines: Array<{ description: string; quantity: unknown; unit?: string | null }>;
  },
  locale: FabricWhatsAppLocale = 'ar',
): string {
  const copy = copyFor(locale);
  const lines = po.lines
    .map((l) => {
      const qty = Number(l.quantity);
      const qtyLabel = Number.isFinite(qty) ? String(qty) : String(l.quantity);
      const unit = l.unit?.trim() ? ` ${l.unit.trim()}` : '';
      return `• ${l.description}: ${qtyLabel}${unit}`;
    })
    .join('\n');
  return `${copy.poHeader(po.number)}\n${copy.poPlease}\n${lines}\n${copy.thanks}`;
}
