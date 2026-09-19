'use client';

import { ListPage } from '@/components/list-page';
import { Link } from '@/i18n/navigation';
import { FilterChip, FilterPanel, StatusBadge } from '@maher/ui';
import { presentQuotationStatus } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface Row {
  id: string;
  number: string;
  version: number;
  status: string;
  total?: string | number;
  commerciallyExpired?: boolean;
}

export default function CustomerQuotationsPage() {
  const locale = useLocale();
  const t = useTranslations('quotations');
  const tCommon = useTranslations('common');
  const [filterOpen, setFilterOpen] = useState(false);
  const [status, setStatus] = useState('');

  return (
    <ListPage<Row>
      title={t('title')}
      emptyDescription={tCommon('quotesSubtitle')}
      queryKey={['customer-quotations-list', status]}
      fetchPath={`/api/v1/quotations${status ? `?status=${encodeURIComponent(status)}` : ''}`}
      emptyTitle={t('empty')}
      actions={
        <>
          <button type="button" className="text-sm text-brand hover:underline" onClick={() => setFilterOpen(true)}>
            {tCommon('filter')}
          </button>
          <FilterPanel
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            title={tCommon('filter')}
            onApply={() => setFilterOpen(false)}
            onClear={() => setStatus('')}
          >
            {['', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].map((s) => (
              <FilterChip key={s || 'all'} selected={status === s} onClick={() => setStatus(s)}>
                {s || tCommon('all')}
              </FilterChip>
            ))}
          </FilterPanel>
        </>
      }
      columns={[
        {
          key: 'number',
          header: t('number'),
          render: (r) => (
            <Link href={`/dealer/quotations/${r.id}`} className="font-medium text-brand hover:underline">
              {r.number} v{r.version}
            </Link>
          ),
        },
        { key: 'total', header: t('total'), render: (r) => String(r.total ?? '—') },
        {
          key: 'status',
          header: tCommon('status'),
          render: (r) => (
            <StatusBadge
              status={r.status}
              label={presentQuotationStatus(locale, r.status, r.commerciallyExpired)}
            />
          ),
        },
      ]}
    />
  );
}
