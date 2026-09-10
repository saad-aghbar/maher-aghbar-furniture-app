'use client';

import { workflowDomainIssueText } from '@/lib/workflow-issue-text';
import { Alert } from '@maher/ui';
import { useTranslations } from 'next-intl';

type Issue = { code: string; message: string };

export function WorkflowValidationPanel({ issues }: { issues: Issue[] }) {
  const t = useTranslations('production');
  if (!issues.length) return null;
  return (
    <Alert variant="warning">
      <p className="mb-1 font-medium">{t('workflow.validationTitle')}</p>
      <ul className="list-disc ps-4">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`}>
            {workflowDomainIssueText(issue, t)}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
