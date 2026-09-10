import { can } from '@maher/permissions';
import type { AuthUser } from '@maher/types';

export function canOpenRawMaterialsReport(user: AuthUser | null | undefined): boolean {
  return can(user, 'report.inventory.read') && can(user, 'inventory.cost.read');
}

export type RawMaterialsReportPeriod = 'today' | 'week' | 'month' | 'custom';

export type MaterialsReportSection = 'fabric' | 'foam' | 'wood' | 'accessories';

export const MATERIALS_REPORT_SECTIONS: MaterialsReportSection[] = [
  'fabric',
  'foam',
  'wood',
  'accessories',
];

export type RawMaterialsReportRequest = {
  period: RawMaterialsReportPeriod;
  from?: string;
  to?: string;
  sections: MaterialsReportSection[];
};

export function toggleReportSection(
  current: MaterialsReportSection[],
  next: MaterialsReportSection,
): MaterialsReportSection[] {
  const selected = new Set(current);
  if (selected.has(next)) selected.delete(next);
  else selected.add(next);
  return MATERIALS_REPORT_SECTIONS.filter((section) => selected.has(section));
}

export function validateMaterialsReportSections(
  sections: MaterialsReportSection[],
): 'sectionsRequired' | null {
  return sections.length === 0 ? 'sectionsRequired' : null;
}

export function sectionsQueryValue(sections: MaterialsReportSection[]): string {
  if (
    sections.length === MATERIALS_REPORT_SECTIONS.length &&
    MATERIALS_REPORT_SECTIONS.every((section) => sections.includes(section))
  ) {
    return 'all';
  }
  return sections.join(',');
}

export function validateRawMaterialsReportRange(
  period: RawMaterialsReportPeriod,
  from: string,
  to: string,
): 'rangeRequired' | 'rangeInvalid' | null {
  if (period !== 'custom') return null;
  if (!from.trim() || !to.trim()) return 'rangeRequired';
  if (from > to) return 'rangeInvalid';
  return null;
}
