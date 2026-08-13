'use client';

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
        {issues.map((issue) => (
          <li key={issue.code}>
            {t(`workflow.errors.${issue.code}` as never, { default: issue.message })}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
