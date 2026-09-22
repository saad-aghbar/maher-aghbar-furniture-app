'use client';

import { workflowDomainIssueText } from '@/lib/workflow-issue-text';
import { Board, Stamp, Ticket } from '@maher/ui';
import { useTranslations } from 'next-intl';

type Issue = { code: string; message: string };

/** Validation findings as tickets — each one names the rule it breaks. */
export function WorkflowValidationPanel({ issues }: { issues: Issue[] }) {
  const t = useTranslations('production');
  if (!issues.length) return null;
  return (
    <Board tone="warning" wash="top">
      <Board.Header title={t('workflow.validationTitle')} meta={<Stamp tone="warning" size="sm">{issues.length}</Stamp>} />
      <Board.Body className="grid gap-2 lg:grid-cols-2">
        {issues.map((issue, index) => (
          <Ticket key={`${issue.code}-${index}`} tone="warning" title={workflowDomainIssueText(issue, t)} why={<span dir="ltr">{issue.code}</span>} />
        ))}
      </Board.Body>
    </Board>
  );
}
