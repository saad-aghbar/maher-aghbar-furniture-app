'use client';

import { useDealerMoney } from '@/components/dealer/catalog-shared';
import { DealerListDesk } from '@/components/dealer/dealer-list-desk';
import { Ltr, Stamp, type BoardTone } from '@maher/ui';
import { presentQuotationStatus } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

interface Row {
  id: string;
  number: string;
  version: number;
  status: string;
  total?: string | number;
  validUntil?: string | null;
  commerciallyExpired?: boolean;
}

function quoteTone(row: Row): BoardTone {
  const s = row.status.toUpperCase();
  if (row.commerciallyExpired || s === 'EXPIRED') return 'neutral';
  if (s === 'SENT') return 'warning';
  if (s === 'ACCEPTED') return 'success';
  if (s === 'REJECTED') return 'error';
  return 'info';
}

export default function CustomerQuotationsPage() {
  const locale = useLocale();
  const t = useTranslations('quotations');
  const tCommon = useTranslations('common');
  const money = useDealerMoney();
  const isSent = (r: Row) => r.status.toUpperCase() === 'SENT' && !r.commerciallyExpired;
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });

  return (
    <DealerListDesk<Row>
      title={t('title')}
      description={tCommon('quotesSubtitle')}
      tone="info"
      queryKey={['customer-quotations-list']}
      fetchPath="/api/v1/quotations?pageSize=50"
      emptyTitle={t('empty')}
      emptyDescription={tCommon('quotesSubtitle')}
      rowHref={(r) => `/dealer/quotations/${r.id}`}
      chips={[
        { id: 'all', label: tCommon('all'), match: () => true },
        { id: 'sent', label: t('laneSent'), tone: 'warning', match: isSent },
        { id: 'accepted', label: t('laneAccepted'), tone: 'success', match: (r) => r.status.toUpperCase() === 'ACCEPTED' },
        { id: 'rejected', label: t('laneRejected'), tone: 'error', match: (r) => r.status.toUpperCase() === 'REJECTED' },
        { id: 'expired', label: t('laneExpired'), tone: 'neutral', match: (r) => r.commerciallyExpired || r.status.toUpperCase() === 'EXPIRED' },
      ]}
      figures={(rows) => [
        { label: t('title'), value: rows.length },
        { label: t('awaitingYou'), value: rows.filter(isSent).length, tone: 'warning' },
        { label: t('laneAccepted'), value: rows.filter((r) => r.status.toUpperCase() === 'ACCEPTED').length, tone: 'success' },
      ]}
      search={{ placeholder: t('number'), match: (r, q) => `${r.number} v${r.version}`.toLowerCase().includes(q) }}
      columns={[
        {
          key: 'number',
          header: t('number'),
          cell: (r) => (
            <span className="flex items-center gap-2">
              <Ltr className="font-semibold text-[var(--maher-text-primary)]">{r.number}</Ltr>
              <Stamp tone="neutral" size="sm">v{r.version}</Stamp>
            </span>
          ),
        },
        { key: 'valid', header: t('validUntil'), hideBelow: 'md', cell: (r) => (r.validUntil ? <Ltr className="text-[var(--maher-text-secondary)]">{dateFmt.format(new Date(r.validUntil))}</Ltr> : '—') },
        { key: 'total', header: t('total'), numeric: true, cell: (r) => <Ltr className="font-semibold">{money(r.total == null ? null : Number(r.total))}</Ltr> },
        { key: 'status', header: tCommon('status'), cell: (r) => <Stamp tone={quoteTone(r)} size="sm">{presentQuotationStatus(locale, r.status, r.commerciallyExpired)}</Stamp> },
      ]}
      mobileRow={(r) => ({ title: `${r.number} v${r.version}`, meta: money(r.total == null ? null : Number(r.total)), trailing: <Stamp tone={quoteTone(r)} size="sm">{presentQuotationStatus(locale, r.status, r.commerciallyExpired)}</Stamp> })}
    />
  );
}
