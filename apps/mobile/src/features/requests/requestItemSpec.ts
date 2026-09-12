import type { RequestItem } from './types';

export function formatRequestItemSpec(item: RequestItem): string {
  const dims = [item.width, item.height, item.depth]
    .map((n) => (n == null || n === '' ? null : String(n)))
    .filter(Boolean);
  const parts = [
    item.variantLabel,
    dims.length ? dims.join('×') : null,
    item.orientation && item.orientation !== 'NONE' ? item.orientation : null,
    item.woodType,
    item.woodColor,
    item.foamDensity,
    item.finish,
    item.accessories,
    item.fabricType ?? item.fabric,
    item.fabricColor ?? item.color,
    item.material,
    ...(item.fabrics ?? [])
      .map((row) => [row.type, row.color, row.role].filter(Boolean).join(' · '))
      .filter(Boolean),
    ...(item.options ?? [])
      .map((row) => row.code || row.nameEn || row.nameAr)
      .filter(Boolean),
    ...(item.customMeasurements ?? []).map((row) => `${row.label} ${row.value}`.trim()),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}
