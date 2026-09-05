import { can } from '@maher/permissions';
import type { AuthUser } from '@maher/types';

export function canOpenRawMaterialsReport(user: AuthUser | null | undefined): boolean {
  return can(user, 'report.inventory.read') && can(user, 'inventory.cost.read');
}

export type RawMaterialsReportPeriod = 'today' | 'week' | 'month' | 'custom';

export type RawMaterialsReportRequest = {
  period: RawMaterialsReportPeriod;
  from?: string;
  to?: string;
};

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
