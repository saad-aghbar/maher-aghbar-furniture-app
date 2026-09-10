import { categoryGroupFromCategory, type InventoryCategoryGroup } from './api';

export function filterLowStockByGroup<T extends { category?: string | null }>(
  items: T[],
  group: InventoryCategoryGroup,
): T[] {
  return items.filter((item) => categoryGroupFromCategory(item.category) === group);
}

export function lowStockShortfall(item: { minStock: number; onHand: number }): number {
  return item.minStock - item.onHand;
}

export function sortLowStockByShortfall<T extends { minStock: number; onHand: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => lowStockShortfall(b) - lowStockShortfall(a));
}

export function toggleLowStockPick(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function lowStockBuilderHref(ids: string[]): string {
  const clean = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  return `/(app)/(admin)/purchasing/new?itemIds=${clean.map(encodeURIComponent).join(',')}`;
}
