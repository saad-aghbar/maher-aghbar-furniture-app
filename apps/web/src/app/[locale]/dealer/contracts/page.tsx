'use client';

import { useDealerMoney } from '@/components/dealer/catalog-shared';
import { DealerListDesk } from '@/components/dealer/dealer-list-desk';
import { Ltr, Stamp, type BoardTone } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';

interface ContractRow {
  id: string;
  number: string;
  status: string;
  contractValue: string | number;
  startDate?: string | null;
  endDate?: string | null;
  salesOrder?: { id: string; number: string } | null;
}

function tone(status: string): BoardTone {
  const s = status.toUpperCase();
  if (s === 'ACTIVE' || s === 'SIGNED') return 'success';
  if (s === 'DRAFT' || s === 'PENDING') return 'warning';
  if (s === 'EXPIRED' || s === 'CANCELLED' || s === 'TERMINATED') return 'neutral';
  return 'brand';
}

export default function ContractsPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');
  const tAcc = useTranslations('accounting');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const money = useDealerMoney();
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const label = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };
  const isActive = (r: ContractRow) => ['ACTIVE', 'SIGNED'].includes(r.status.toUpperCase());

  return (
    <DealerListDesk<ContractRow>
      title={t('contracts')}
      description={tAcc('contractsHint')}
      tone="info"
      queryKey={['customer-contracts']}
      fetchPath="/api/v1/contracts?pageSize=50"
      emptyTitle={tCommon('emptyList')}
      rowHref={(row) => (row.salesOrder ? `/dealer/orders/${row.salesOrder.id}` : '/dealer/contracts')}
      chips={[
        { id: 'all', label: tCommon('all'), match: () => true },
        { id: 'active', label: label('ACTIVE'), tone: 'success', match: isActive },
        { id: 'pending', label: label('PENDING'), tone: 'warning', match: (r) => ['DRAFT', 'PENDING'].includes(r.status.toUpperCase()) },
        { id: 'closed', label: label('EXPIRED'), tone: 'neutral', match: (r) => ['EXPIRED', 'CANCELLED', 'TERMINATED', 'COMPLETED'].includes(r.status.toUpperCase()) },
      ]}
      figures={(rows) => [
        { label: t('contracts'), value: rows.length },
        { label: label('ACTIVE'), value: rows.filter(isActive).length, tone: 'success' },
        { label: tCommon('total'), value: money(rows.filter(isActive).reduce((a, r) => a + Number(r.contractValue || 0), 0)), tone: 'info' },
      ]}
      search={{ placeholder: tCommon('number'), match: (r, q) => `${r.number} ${r.salesOrder?.number ?? ''}`.toLowerCase().includes(q) }}
      columns={[
        { key: 'number', header: tCommon('number'), cell: (row) => <Ltr className="font-semibold text-[var(--maher-text-primary)]">{row.number}</Ltr> },
        { key: 'order', header: tc('salesOrder'), hideBelow: 'md', cell: (row) => (row.salesOrder ? <Ltr>{row.salesOrder.number}</Ltr> : '—') },
        { key: 'dates', header: tCommon('date'), hideBelow: 'lg', cell: (row) => <Ltr className="text-[var(--maher-text-secondary)]">{[row.startDate, row.endDate].filter(Boolean).map((d) => dateFmt.format(new Date(d!))).join(' → ') || '—'}</Ltr> },
        { key: 'value', header: tCommon('total'), numeric: true, cell: (row) => <Ltr className="font-semibold">{money(Number(row.contractValue))}</Ltr> },
        { key: 'status', header: tCommon('status'), cell: (row) => <Stamp tone={tone(row.status)} size="sm">{label(row.status)}</Stamp> },
      ]}
      mobileRow={(row) => ({ title: row.number, meta: money(Number(row.contractValue)), trailing: <Stamp tone={tone(row.status)} size="sm">{label(row.status)}</Stamp> })}
    />
  );
}
