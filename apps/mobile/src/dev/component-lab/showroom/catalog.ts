import { buildFeatureShowroomItems } from '../sections/showroomFeatures';
import { buildSharedShowroomItems } from '../sections/showroomShared';
import type { LabRole } from '../registry/types';
import type { ShowroomItem } from './types';

const SECTION_ORDER = [
  'FOUNDATIONS',
  'BUTTONS',
  'CARDS',
  'SEARCH & FILTERS',
  'FORMS',
  'STATUS',
  'HEADERS',
  'NAVIGATION',
  'SHEETS & POPUPS',
  'LOADING / EMPTY / ERROR',
  'ORDERS',
  'PRODUCTION',
  'WORKFLOW',
  'WORKER',
  'INVENTORY',
  'RAW',
  'SEMI',
  'FINISHED',
  'PURCHASING',
  'PRODUCTS',
  'QUALITY',
  'PACKAGING',
  'DELIVERIES',
  'RETURNS',
  'FINANCE',
  'DEALER',
  'MANAGEMENT',
  'REPORTS',
  'NOTIFICATIONS',
  'AI',
  'AUTH',
  'PDF',
  'FULL SCREENS',
] as const;

let cached: ShowroomItem[] | null = null;

function matchesQuery(item: ShowroomItem, q: string): boolean {
  if (!q) return true;
  const hay = [
    item.id,
    item.componentName,
    item.section,
    item.sourceFile,
    item.description,
    ...item.tags,
    ...(item.contains ?? []),
    ...item.usedIn,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function getShowroomCatalog(): ShowroomItem[] {
  if (cached) return cached;
  const items = [...buildSharedShowroomItems(), ...buildFeatureShowroomItems()];
  for (const item of items) {
    if (item.mode === 'inline' && !item.render && !item.variants?.length) {
      throw new Error(`Showroom item ${item.id} missing inline render`);
    }
    if (item.mode === 'sheet' && !item.renderSheet) {
      throw new Error(`Showroom item ${item.id} missing renderSheet`);
    }
    if (item.mode === 'screen' && !item.screenHref) {
      throw new Error(`Showroom item ${item.id} missing screenHref`);
    }
    if (item.mode === 'represented' && !item.representedIn) {
      throw new Error(`Showroom item ${item.id} missing representedIn`);
    }
  }
  cached = items;
  return cached;
}

export function getShowroomSections(): string[] {
  const present = new Set(
    getShowroomCatalog()
      .filter((i) => i.mode !== 'represented')
      .map((i) => i.section),
  );
  return SECTION_ORDER.filter((s) => present.has(s));
}

/**
 * Filters the showroom list. Parent-represented entries never render empty rows —
 * a search hit remaps to the parent demo.
 */
export function filterShowroom(
  items: ShowroomItem[],
  opts: { query?: string; role?: LabRole | 'All'; section?: string },
): ShowroomItem[] {
  const q = opts.query?.trim().toLowerCase() ?? '';
  const byId = new Map(items.map((i) => [i.id, i]));
  const matched = items.filter((item) => {
    if (
      opts.role &&
      opts.role !== 'All' &&
      item.role !== opts.role &&
      item.role !== 'Shared'
    ) {
      return false;
    }
    if (opts.section && opts.section !== 'All' && item.section !== opts.section) {
      return false;
    }
    if (item.mode === 'represented') {
      return Boolean(q) && matchesQuery(item, q);
    }
    return matchesQuery(item, q);
  });

  const out: ShowroomItem[] = [];
  const seen = new Set<string>();
  for (const item of matched) {
    const resolved =
      item.mode === 'represented' && item.representedIn
        ? byId.get(item.representedIn) ?? null
        : item;
    if (!resolved || resolved.mode === 'represented') continue;
    if (seen.has(resolved.id)) continue;
    seen.add(resolved.id);
    out.push(resolved);
  }
  return out;
}

export { SECTION_ORDER };
