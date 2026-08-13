import type {
  InventoryCategoryGroup,
  InventoryCustomMeasurement,
} from './api';

export function starterMeasurements(
  group: InventoryCategoryGroup,
): InventoryCustomMeasurement[] {
  switch (group) {
    case 'fabric':
      return [
        { nameEn: 'Width', nameAr: 'العرض', unit: 'cm', value: null },
        { nameEn: 'Length', nameAr: 'الطول', unit: 'm', value: null },
      ];
    case 'foam':
      return [
        { nameEn: 'Height', nameAr: 'الارتفاع', unit: 'cm', value: null },
        { nameEn: 'Width', nameAr: 'العرض', unit: 'cm', value: null },
        { nameEn: 'Depth', nameAr: 'العمق', unit: 'cm', value: null },
      ];
    case 'wood':
      return [
        { nameEn: 'Thickness', nameAr: 'السماكة', unit: 'cm', value: null },
        { nameEn: 'Width', nameAr: 'العرض', unit: 'cm', value: null },
        { nameEn: 'Length', nameAr: 'الطول', unit: 'cm', value: null },
      ];
    default:
      return [];
  }
}

export function measurementsHaveValues(
  rows: InventoryCustomMeasurement[],
): boolean {
  return rows.some(
    (row) => row.value != null && Number.isFinite(Number(row.value)),
  );
}

export function parseInventoryMeasurements(
  raw: InventoryCustomMeasurement[] | null | undefined,
): InventoryCustomMeasurement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && String(row.nameEn ?? '').trim() && String(row.nameAr ?? '').trim())
    .map((row) => ({
      id: row.id,
      nameEn: String(row.nameEn).trim(),
      nameAr: String(row.nameAr).trim(),
      nameHe: row.nameHe ?? null,
      value:
        row.value != null && Number.isFinite(Number(row.value))
          ? Number(row.value)
          : null,
      unit: String(row.unit ?? 'cm').trim() || 'cm',
    }));
}
