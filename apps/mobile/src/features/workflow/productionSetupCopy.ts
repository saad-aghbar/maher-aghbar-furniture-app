import { localizedName } from '@maher/i18n';
import type { ProductionSetupStage } from '@/api/modules/workflow';

type NamedProduct = {
  sku?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
};

export type ProductionSetupIssueCopy = {
  code: string;
  message: string;
  workflowNodeId?: string | null;
  nodeKey?: string | null;
};

/** Drop leftover example dumps like "(for example A, legs, 3)." */
export function stripExampleParenthetical(text: string): string {
  return text
    .replace(/\s*\((?:for example|e\.g\.|مثلاً|לדוגמה)[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

/** Honest product identity for the setup header — SKU stays Latin. */
export function productionSetupProductLine(
  product: NamedProduct | null | undefined,
  locale: string,
): string | null {
  if (!product) return null;
  const sku = product.sku?.trim() ?? '';
  const name = localizedName(locale, product, '');
  const named = name && name !== '—' ? name : '';
  if (sku && named && named !== sku) return `${sku} / ${named}`;
  return sku || named || null;
}

export function productionSetupIssueText(
  issue: ProductionSetupIssueCopy,
  stages: ProductionSetupStage[],
  locale: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const stage = stages.find(
    (s) =>
      (issue.workflowNodeId && s.workflowNodeId === issue.workflowNodeId) ||
      (issue.nodeKey && s.nodeKey === issue.nodeKey),
  );
  const stageName = stage ? localizedName(locale, stage) : '';

  if (issue.code === 'SETUP_OUTPUT_NAME_REQUIRED' && stageName) {
    return t('mobile.production.workflow.issueOutputName', { stage: stageName });
  }

  const key = `errors.${issue.code}`;
  const translated = t(key);
  const raw = translated === key ? issue.message : translated;
  return stripExampleParenthetical(raw);
}
