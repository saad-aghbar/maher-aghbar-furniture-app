export type WorkflowDomainIssue = { code: string; message: string };

export function workflowDomainIssueText(
  issue: WorkflowDomainIssue,
  t: (key: string, values?: { default?: string }) => string,
): string {
  if (issue.code === 'TERMINAL_MISSING') {
    const stage = issue.message.includes('INSPECTION')
      ? 'INSPECTION'
      : issue.message.includes('PACKAGING')
        ? 'PACKAGING'
        : issue.message.includes('DELIVERY')
          ? 'DELIVERY'
          : null;
    if (stage) {
      return t(`workflow.errors.TERMINAL_MISSING_${stage}`, { default: issue.message });
    }
  }
  return t(`workflow.errors.${issue.code}`, { default: issue.message });
}

export function formatWorkflowDomainIssues(
  issues: WorkflowDomainIssue[],
  t: (key: string, values?: { default?: string }) => string,
): string {
  return issues.map((issue) => workflowDomainIssueText(issue, t)).join('; ');
}
