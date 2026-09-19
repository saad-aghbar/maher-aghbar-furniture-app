'use client';

import { apiFetch, API_URL } from '@/lib/api-client';
import {
  Card,
  EmptyState,
  ErrorState,
  FilterChip,
  FilterPanel,
  Input,
  Ltr,
  PageHero,
  PeriodCells,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type Payment = {
  id: string;
  number: string;
  amount: string | number;
  method: string;
  paymentDate: string;
  referenceNumber?: string | null;
};

type Summary = {
  amountDue?: number;
  availableCredit?: number;
  currency?: string;
};

export default function PaymentsPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState('month');
  const [filterOpen, setFilterOpen] = useState(false);
  const [method, setMethod] = useState('');

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<{ customerId?: string }>('/api/v1/auth/me'),
  });
  const customerId = me.data?.customerId;

  const summary = useQuery({
    queryKey: ['dealer-finance-summary', customerId],
    enabled: Boolean(customerId),
    queryFn: () => apiFetch<Summary>(`/api/v1/payments/dealer/${customerId}/summary`),
    retry: false,
  });

  const list = useQuery({
    queryKey: ['customer-payments', customerId, q, method],
    enabled: Boolean(customerId),
    queryFn: () =>
      apiFetch<{ data: Payment[] } | Payment[]>(
        `/api/v1/payments?customerId=${customerId}&pageSize=100${q ? `&q=${encodeURIComponent(q)}` : ''}${method ? `&method=${method}` : ''}`,
      ).then((json) => (Array.isArray(json) ? json : json.data ?? [])),
  });

  const rows = useMemo(() => {
    const all = list.data ?? [];
    if (!q.trim()) return all;
    const needle = q.trim().toLowerCase();
    return all.filter((row) => `${row.number} ${row.referenceNumber ?? ''}`.toLowerCase().includes(needle));
  }, [list.data, q]);

  if (me.isLoading || list.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (list.isError) return <ErrorState title={t('payments')} onRetry={() => list.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHero tone="soft" title={t('payments')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-text-secondary">{tCommon('outstanding')}</p>
          <Ltr className="text-xl font-medium">
            {summary.data?.amountDue ?? '—'} {tCommon('currency')}
          </Ltr>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">{tCommon('credit')}</p>
          <Ltr className="text-xl font-medium">
            {summary.data?.availableCredit ?? '—'} {tCommon('currency')}
          </Ltr>
        </Card>
      </div>
      <PeriodCells
        value={period}
        onChange={setPeriod}
        items={[
          { id: 'today', label: tCommon('periodToday') },
          { id: 'week', label: tCommon('periodWeek') },
          { id: 'month', label: tCommon('periodMonth') },
          { id: 'custom', label: tCommon('periodCustom') },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Input withSearchIcon value={q} onChange={(e) => setQ(e.target.value)} placeholder={tCommon('search')} className="max-w-sm" />
        <button type="button" className="text-sm text-brand hover:underline" onClick={() => setFilterOpen(true)}>
          {tCommon('filter')}
        </button>
      </div>
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={tCommon('filter')}
        onApply={() => setFilterOpen(false)}
        onClear={() => setMethod('')}
      >
        {['', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'].map((m) => (
          <FilterChip key={m || 'all'} selected={method === m} onClick={() => setMethod(m)}>
            {m || tCommon('all')}
          </FilterChip>
        ))}
      </FilterPanel>
      {rows.length === 0 ? (
        <EmptyState title={tCommon('emptyList')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('amount')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('date')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('paymentMethod')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <button
                    type="button"
                    className="font-medium text-brand hover:underline"
                    onClick={() => window.open(`${API_URL}/api/v1/payments/${row.id}/pdf`, '_blank')}
                  >
                    {row.number}
                  </button>
                </TableCell>
                <TableCell dir="ltr">{String(row.amount)}</TableCell>
                <TableCell dir="ltr">{row.paymentDate?.slice(0, 10)}</TableCell>
                <TableCell>{row.method}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
