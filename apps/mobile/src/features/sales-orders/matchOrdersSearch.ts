import { formatDateLatn } from '@/i18n/format';

export type OrdersSearchable = {
  number?: string | null;
  title?: string | null;
  externalOrderNumber?: string | null;
  deliveryDate?: string | null;
  requiredDeliveryDate?: string | null;
  dealerName?: string | null;
  projectName?: string | null;
  customer?: {
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
  } | null;
  /** Factory / production order numbers */
  productionOrderNumbers?: Array<string | null | undefined> | null;
  kind?: 'order' | 'rfq';
};

function push(hay: string[], value: string | null | undefined) {
  const v = value?.trim();
  if (v) hay.push(v);
}

/**
 * Client-side match for fixtures / offline / dealer hub rows.
 * Covers order name, SO number, dealer PO, factory PO, dealer name, and dates.
 */
export function matchOrdersSearch(item: OrdersSearchable, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;

  const hay: string[] = [];
  push(hay, item.number);
  push(hay, item.title);
  push(hay, item.externalOrderNumber);
  push(hay, item.projectName);
  push(hay, item.dealerName);
  push(hay, item.customer?.name);
  push(hay, item.customer?.nameEn);
  push(hay, item.customer?.nameAr);
  push(hay, item.customer?.nameHe);
  push(hay, item.customer?.code);

  for (const n of item.productionOrderNumbers ?? []) {
    push(hay, n);
  }

  const delivery = item.deliveryDate ?? item.requiredDeliveryDate;
  if (delivery) {
    push(hay, delivery);
    try {
      push(hay, formatDateLatn(delivery));
      const d = new Date(delivery);
      if (!Number.isNaN(d.getTime())) {
        push(hay, d.toISOString().slice(0, 10));
      }
    } catch {
      // ignore bad dates
    }
  }

  return hay.some((h) => h.toLowerCase().includes(needle));
}
