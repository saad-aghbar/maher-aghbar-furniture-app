'use client';

import { ListPage } from '@/components/list-page';
import { useTranslations } from 'next-intl';

interface Row {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string | null } | null;
}

export default function AuditPage() {
  const t = useTranslations('navigation');

  return (
    <ListPage<Row>
      title={t('audit')}
      queryKey={['audit']}
      fetchPath="/api/v1/audit"
      emptyTitle="No audit events"
      columns={[
        {
          key: 'when',
          header: 'When',
          render: (r) => new Date(r.createdAt).toLocaleString(),
        },
        { key: 'action', header: 'Action', render: (r) => r.action },
        {
          key: 'entity',
          header: 'Entity',
          render: (r) => `${r.entityType}${r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}`,
        },
        {
          key: 'user',
          header: 'User',
          render: (r) =>
            r.user ? `${r.user.firstName} ${r.user.lastName}` : '—',
        },
      ]}
    />
  );
}
