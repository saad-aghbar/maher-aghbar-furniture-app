'use client';

import { ListPage } from '@/components/list-page';
import { useTranslations } from 'next-intl';

interface Row {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles?: Array<{ role: { code: string; nameEn: string } }>;
}

export default function UsersPage() {
  const t = useTranslations('navigation');

  return (
    <ListPage<Row>
      title={t('users')}
      queryKey={['users']}
      fetchPath="/api/v1/users"
      emptyTitle="No users"
      columns={[
        {
          key: 'name',
          header: 'Name',
          render: (r) => `${r.firstName} ${r.lastName}`,
        },
        { key: 'email', header: 'Email', render: (r) => r.email ?? '—' },
        {
          key: 'roles',
          header: 'Roles',
          render: (r) => (r.roles ?? []).map((ur) => ur.role.code).join(', ') || '—',
        },
        {
          key: 'active',
          header: 'Active',
          render: (r) => (r.isActive ? 'Yes' : 'No'),
        },
      ]}
    />
  );
}
