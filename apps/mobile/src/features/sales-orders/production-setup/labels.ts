import type { Locale } from '@maher/types';
import { localizedName } from '@maher/i18n';
import type {
  ManufacturingComplexity,
  OrderProductionSetupLine,
  SetupMaterialStatus,
} from '../api';
import { complexityBadgeKey as sharedComplexityBadgeKey } from '../orderManufacturingKind';

export function complexityBadgeKey(
  complexity: ManufacturingComplexity | string | null | undefined,
): 'standard' | 'modified' | 'custom' {
  return sharedComplexityBadgeKey(complexity);
}

export function materialStatusKey(status: SetupMaterialStatus | string | null | undefined): string {
  return String(status ?? 'NEEDS_SELECTION').toUpperCase();
}

export function lineDisplayName(
  line: OrderProductionSetupLine,
  locale: Locale,
): string {
  if (line.manufacturingName?.trim()) return line.manufacturingName.trim();
  if (line.product) {
    return localizedName(locale, line.product, line.description ?? line.product.sku);
  }
  return line.description?.trim() || '—';
}

export function dealerDisplayName(
  customer:
    | {
        nameEn?: string | null;
        nameAr?: string | null;
        code?: string | null;
      }
    | null
    | undefined,
  locale: Locale,
): string {
  if (!customer) return '—';
  return localizedName(
    locale,
    { nameEn: customer.nameEn ?? '', nameAr: customer.nameAr ?? '' },
    customer.code ?? '—',
  );
}

export function formatDim(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function categoryGroupKey(category: string | null | undefined): string {
  const c = String(category ?? '').toUpperCase();
  if (c.includes('FABRIC') || c.includes('قماش')) return 'fabric';
  if (c.includes('FOAM') || c.includes('اسفنج') || c.includes('إسفنج')) return 'foam';
  if (c.includes('WOOD') || c.includes('خشب')) return 'wood';
  return 'accessories';
}

export function assignmentMissingCount(summary: {
  assignment?: {
    missingCount?: number;
    missing?: unknown[];
  } | null;
} | null | undefined): number {
  if (!summary?.assignment) return 0;
  if (typeof summary.assignment.missingCount === 'number') {
    return summary.assignment.missingCount;
  }
  return summary.assignment.missing?.length ?? 0;
}
