'use client';

import { DealerListDesk } from '@/components/dealer/dealer-list-desk';
import { useRouter } from '@/i18n/navigation';
import { Button, Ltr, Stamp, type BoardTone } from '@maher/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface RequestRow {
  id: string;
  number: string;
  status: string;
  source?: string;
  createdAt?: string;
  externalOrderNumber?: string | null;
  items?: Array<{ productName: string }>;
}

const SOURCE_KEYS: Record<string, 'channelPortal' | 'channelWhatsapp' | 'channelEmail' | 'channelPdf' | 'channelPhone'> = {
  PORTAL: 'channelPortal',
  WHATSAPP: 'channelWhatsapp',
  EMAIL: 'channelEmail',
  PDF: 'channelPdf',
  PHONE: 'channelPhone',
};

const OPEN = new Set(['DRAFT', 'SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'IN_REVIEW', 'NEEDS_INFORMATION', 'NEED_INFO']);
const QUOTED = new Set(['QUOTED', 'READY_FOR_QUOTATION']);

function statusTone(status: string): BoardTone {
  const key = status.toUpperCase();
  if (QUOTED.has(key)) return 'success';
  if (/NEED/.test(key)) return 'error';
  if (/(CLOSED|CANCEL|REJECT)/.test(key)) return 'neutral';
  if (OPEN.has(key)) return 'warning';
  return 'info';
}

export default function RequestsPage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tQ = useTranslations('quotations');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const router = useRouter();

  const sourceLabel = (value?: string) => {
    if (!value) return '—';
    const key = SOURCE_KEYS[value];
    return key ? tQ(key) : value;
  };
  const statusLabel = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };

  return (
    <DealerListDesk<RequestRow>
      title={t('rfqs')}
      description={tQ('requestsHint')}
      queryKey={['customer-requests']}
      fetchPath="/api/v1/requests?pageSize=50"
      emptyTitle={tQ('noRequestsYet')}
      emptyDescription={tQ('noRequestsHint')}
      rowHref={(row) => `/dealer/orders/requests/${row.id}`}
      actions={
        <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/dealer/quotations/request')}>
          {tQ('requestQuoteCta')}
        </Button>
      }
      chips={[
        { id: 'all', label: tCommon('all'), match: () => true },
        { id: 'open', label: tQ('laneOpen'), tone: 'warning', match: (r) => OPEN.has(r.status.toUpperCase()) && !/NEED/.test(r.status) },
        { id: 'needs', label: tQ('laneSent'), tone: 'error', match: (r) => /NEED/.test(r.status.toUpperCase()) },
        { id: 'quoted', label: tQ('laneQuoted'), tone: 'success', match: (r) => QUOTED.has(r.status.toUpperCase()) },
        { id: 'closed', label: tQ('laneClosed'), tone: 'neutral', match: (r) => /(CLOSED|CANCEL|REJECT)/.test(r.status.toUpperCase()) },
      ]}
      figures={(rows) => [
        { label: t('rfqs'), value: rows.length },
        { label: tQ('laneOpen'), value: rows.filter((r) => OPEN.has(r.status.toUpperCase())).length, tone: 'warning' },
        { label: tQ('laneQuoted'), value: rows.filter((r) => QUOTED.has(r.status.toUpperCase())).length, tone: 'success' },
      ]}
      search={{ placeholder: tc('searchProducts'), match: (r, q) => `${r.number} ${r.externalOrderNumber ?? ''} ${(r.items ?? []).map((i) => i.productName).join(' ')}`.toLowerCase().includes(q) }}
      columns={[
        {
          key: 'number',
          header: tc('rfq'),
          cell: (row) => (
            <span className="min-w-0">
              <Ltr className="block font-semibold text-[var(--maher-text-primary)]">{row.number}</Ltr>
              {row.externalOrderNumber ? <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{row.externalOrderNumber}</Ltr> : null}
            </span>
          ),
        },
        { key: 'items', header: tc('lineItems'), cell: (row) => <span className="line-clamp-1 text-[var(--maher-text-secondary)]">{row.items?.map((i) => i.productName).join(', ') || '—'}</span> },
        { key: 'source', header: tQ('channel'), hideBelow: 'lg', cell: (row) => sourceLabel(row.source) },
        { key: 'status', header: tCommon('status'), cell: (row) => <Stamp tone={statusTone(row.status)} size="sm">{statusLabel(row.status)}</Stamp> },
      ]}
      mobileRow={(row) => ({ title: row.number, meta: row.items?.map((i) => i.productName).join(', ') || sourceLabel(row.source), trailing: <Stamp tone={statusTone(row.status)} size="sm">{statusLabel(row.status)}</Stamp> })}
    />
  );
}
