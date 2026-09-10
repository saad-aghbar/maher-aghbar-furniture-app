export type DemandCartRow = {
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  category?: string | null;
  unit: string;
  quantity: string;
  unitPrice: string;
  imageUrl?: string | null;
};

const KEY = 'purchasing-demand-cart';

export function setDemandCart(rows: DemandCartRow[]) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(rows));
}

export function takeDemandCart(): DemandCartRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemandCartRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
