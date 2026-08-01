'use client';

import { ListPage } from '@/components/list-page';
import { Link } from '@/i18n/navigation';
import { Input, Select } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Row {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string | null } | null;
}

const ENTITY_TYPES = [
  'User',
  'Customer',
  'Quotation',
  'SalesOrder',
  'Invoice',
  'Request',
  'ProductionOrder',
  'Delivery',
  'Product',
  'Material',
  'Fabric',
  'Role',
  'SystemSetting',
  'Document',
] as const;

function entityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case 'Customer':
      return `/customers/${entityId}`;
    case 'Quotation':
      return `/quotations/${entityId}`;
    case 'SalesOrder':
      return `/sales-orders/${entityId}`;
    case 'Invoice':
      return `/invoices/${entityId}`;
    case 'Request':
      return `/requests/${entityId}`;
    case 'ProductionOrder':
      return `/production/${entityId}`;
    case 'Delivery':
      return `/deliveries`;
    case 'Product':
      return `/products`;
    case 'Material':
      return `/materials`;
    case 'Fabric':
      return `/fabrics`;
    case 'Role':
      return `/roles`;
    case 'User':
      return `/users`;
    case 'Document':
      return `/documents`;
    default:
      return null;
  }
}

export default function AuditPage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');

  const fetchPath = useMemo(() => {
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (entityType) params.set('entityType', entityType);
    if (action.trim()) params.set('action', action.trim());
    return `/api/v1/audit?${params.toString()}`;
  }, [entityType, action]);

  return (
    <ListPage<Row>
      title={t('audit')}
      queryKey={['audit', entityType, action]}
      fetchPath={fetchPath}
      emptyTitle={tc('noAuditEvents')}
      toolbar={
        <div className="flex flex-wrap items-end gap-3">
          <Select
            className="min-w-[180px]"
            label={tc('entity')}
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">{tCommon('all')}</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Input
            className="min-w-[200px]"
            label={tc('action')}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder={tc('actionFilterPlaceholder')}
          />
        </div>
      }
      columns={[
        {
          key: 'when',
          header: tc('when'),
          render: (r) => (
            <span dir="ltr">{new Date(r.createdAt).toLocaleString()}</span>
          ),
        },
        { key: 'action', header: tc('action'), render: (r) => r.action },
        {
          key: 'entity',
          header: tc('entity'),
          render: (r) => {
            const label = `${r.entityType}${r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}`;
            const href = entityHref(r.entityType, r.entityId);
            if (!href) return <span dir="ltr">{label}</span>;
            return (
              <Link href={href} className="font-medium text-brand hover:underline" dir="ltr">
                {label}
              </Link>
            );
          },
        },
        {
          key: 'user',
          header: tc('user'),
          render: (r) => (r.user ? `${r.user.firstName} ${r.user.lastName}` : '—'),
        },
      ]}
    />
  );
}
