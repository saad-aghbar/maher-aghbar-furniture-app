import type { WorkflowScope } from '@/api/modules/workflow';
import { isReturnWorkflowScope } from '@maher/types';

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
