import type { OrderPlanCatalogTemplate } from '@/api/modules/production';

export type PlanTypeLens = 'standard' | 'modified' | 'custom';

export function planTypeLens(
  complexity?: string | null,
): PlanTypeLens {
  const raw = String(complexity ?? '').toUpperCase();
  if (raw === 'MODIFIED') return 'modified';
  if (raw === 'CUSTOM') return 'custom';
  return 'standard';
}

export function isCatalogTemplateActionAvailable(
  template: OrderPlanCatalogTemplate | null | undefined,
): boolean {
  return Boolean(template?.showBoard && template.actionAvailable);
}

export function isPlanTypeBoardVisible(
  template: OrderPlanCatalogTemplate | null | undefined,
): boolean {
  return Boolean(template?.showBoard);
}

/** @deprecated Use isCatalogTemplateActionAvailable */
export function isStandardCatalogTemplateActionAvailable(
  template: OrderPlanCatalogTemplate | null | undefined,
): boolean {
  return isCatalogTemplateActionAvailable(template);
}

/** @deprecated Use isPlanTypeBoardVisible */
export function isStandardCatalogTemplateBoardVisible(
  template: OrderPlanCatalogTemplate | null | undefined,
): boolean {
  return isPlanTypeBoardVisible(template);
}
