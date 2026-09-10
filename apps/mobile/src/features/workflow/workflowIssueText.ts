export type WorkflowDomainIssue = { code: string; message: string };

export function workflowDomainIssueText(
  issue: WorkflowDomainIssue,
  t: (key: string) => string,
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
      const key = `mobile.production.workflow.errors.TERMINAL_MISSING_${stage}`;
      const translated = t(key);
      if (translated !== key) return translated;
    }
  }
  const key = `mobile.production.workflow.errors.${issue.code}`;
  const translated = t(key);
  return translated === key ? issue.message : translated;
}

export function formatWorkflowDomainIssues(
  issues: WorkflowDomainIssue[],
  t: (key: string) => string,
): string {
  return issues.map((issue) => workflowDomainIssueText(issue, t)).join('; ');
}
