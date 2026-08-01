'use client';

import { ListPage } from '@/components/list-page';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface RequestRow {
  id: string;
  number: string;
  status: string;
  source?: string;
  items?: Array<{ productName: string }>;
}

const SOURCE_KEYS: Record<string, 'channelPortal' | 'channelWhatsapp' | 'channelEmail' | 'channelPdf' | 'channelPhone'> = {
  PORTAL: 'channelPortal',
  WHATSAPP: 'channelWhatsapp',
  EMAIL: 'channelEmail',
  PDF: 'channelPdf',
  PHONE: 'channelPhone',
};

export default function RequestsPage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tQ = useTranslations('quotations');
  const tCommon = useTranslations('common');

  function sourceLabel(value?: string) {
    if (!value) return '—';
    const key = SOURCE_KEYS[value];
    return key ? tQ(key) : value;
  }

  return (
    <ListPage<RequestRow>
      title={t('rfqs')}
      queryKey={['customer-requests']}
      fetchPath="/api/v1/requests?pageSize=50"
      emptyTitle={tQ('noRequestsYet')}
      emptyDescription={tQ('noRequestsHint')}
      columns={[
        {
          key: 'number',
          header: tc('rfq'),
          render: (row) => <span className="font-medium text-brand">{row.number}</span>,
        },
        {
          key: 'source',
          header: tQ('channel'),
          render: (row) => sourceLabel(row.source),
        },
        {
          key: 'items',
          header: tc('lineItems'),
          render: (row) => row.items?.map((i) => i.productName).join(', ') ?? '—',
        },
        {
          key: 'status',
          header: tCommon('status'),
          render: (row) => <StatusBadge status={row.status} />,
        },
      ]}
    />
  );
}
