import { localizedName } from '@maher/i18n';
import { isReturnWorkflowScope, type Locale } from '@maher/types';
import type { WorkflowListItem, WorkflowScope } from '@/api/modules/workflow';

export function preferredWorkflowScope(
  originType?: string | null,
): WorkflowScope {
  return originType === 'RETURN_WORK' ||
    originType === 'REPLACEMENT' ||
    originType === 'RETURN_RECOVERY'
    ? 'RETURN'
    : 'STANDARD';
}

export function workflowScopeLabelKey(scope?: string | null): string {
  return isReturnWorkflowScope(scope)
    ? 'mobile.production.workflow.scopeReturn'
    : 'mobile.production.workflow.scopeStandard';
}

/** `null` filter = All. STANDARD excludes return/recovery paths. */
export function matchesWorkflowScopeFilter(
  scope: string | null | undefined,
  filter: WorkflowScope | null,
): boolean {
  if (!filter) return true;
  if (filter === 'RETURN') return isReturnWorkflowScope(scope);
  return !isReturnWorkflowScope(scope);
}

export function filterWorkflowsForPicker(
  rows: WorkflowListItem[],
  opts: {
    query: string;
    locale: Locale;
    scopeFilter: WorkflowScope | null;
    preferredScope?: WorkflowScope;
  },
): WorkflowListItem[] {
  const q = opts.query.trim().toLowerCase();
  const next = rows.filter((wf) => {
    if (!wf.activeVersion) return false;
    if (!matchesWorkflowScopeFilter(wf.scope, opts.scopeFilter)) return false;
    if (!q) return true;
    const name = localizedName(opts.locale, wf, wf.code).toLowerCase();
    return name.includes(q) || wf.code.toLowerCase().includes(q);
  });
  const preferred = opts.preferredScope;
  if (!preferred) return next;
  return [...next].sort((a, b) => {
    const rank = (scope: string | null | undefined) =>
      matchesWorkflowScopeFilter(scope, preferred) ? 0 : 1;
    return rank(a.scope) - rank(b.scope);
  });
}
