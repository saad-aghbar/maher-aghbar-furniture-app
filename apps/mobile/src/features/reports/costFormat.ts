import type { Locale } from '@maher/types';
import { formatCurrency, formatNumber } from '@/i18n/format';

export function formatCostMoney(locale: Locale, value: number | null | undefined): string {
  return value == null ? '—' : formatCurrency(locale, value);
}

export function formatCostPercent(locale: Locale, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${formatNumber(locale, value, { maximumFractionDigits: 1 })}%`;
}

export function coverageLabelKey(coverage?: string | null, incomplete?: boolean): string {
  if (incomplete) return 'mobile.reports.marginIncomplete';
  if (coverage === 'FINAL') return 'accounting.coverageFinal';
  if (coverage === 'PARTIAL') return 'mobile.reports.partiallyCosted';
  if (coverage === 'UNPRICED') return 'mobile.reports.notCosted';
  return 'mobile.reports.noActualUsage';
}

export function provenanceLabelKey(type?: string | null): string {
  switch (String(type)) {
    case 'PRODUCTION_ISSUE':
      return 'mobile.reports.txIssued';
    case 'PRODUCTION_RETURN':
      return 'mobile.reports.txUnusedReturn';
    case 'SCRAP':
    case 'DAMAGE':
      return 'mobile.reports.txWaste';
    case 'PURCHASE_RECEIPT':
      return 'mobile.reports.txReceipt';
    case 'WAREHOUSE_TRANSFER':
      return 'mobile.reports.txTransfer';
    case 'CUSTOMER_RETURN':
      return 'mobile.reports.flow.recovery';
    case 'INVENTORY_ADJUSTMENT':
      return 'mobile.reports.flow.adjustment';
    case 'SEMI_FINISHED_RECEIPT':
      return 'mobile.reports.txWipOutput';
    case 'FINISHED_GOODS_RECEIPT':
      return 'mobile.reports.txFinishedOutput';
    default:
      return 'mobile.reports.txOther';
  }
}
