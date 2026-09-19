'use client';

import { apiFetch, API_URL } from '@/lib/api-client';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChip,
  FilterPanel,
  Input,
  MotionSection,
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

interface Statement {
  closingBalance: string | number;
  currency: string;
  asOf: string;
  entries: Array<{
    date: string;
    reference: string;
    description: string;
    debit: string;
    credit: string;
    balance: string | number;
  }>;
}

export default function StatementPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAcc = useTranslations('accounting');
  const [period, setPeriod] = useState('month');
  const [type, setType] = useState<'all' | 'debit' | 'credit'>('all');
  const [q, setQ] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: me, isLoading: meLoading, isError: meError } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<{ customerId?: string }>('/api/v1/auth/me'),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['statement', me?.customerId],
    enabled: Boolean(me?.customerId),
    queryFn: () => apiFetch<Statement>(`/api/v1/statements/${me!.customerId}`),
  });

  const entries = useMemo(() => {
    const all = data?.entries ?? [];
    const now = new Date();
    const start = new Date(now);
    if (period === 'today') start.setHours(0, 0, 0, 0);
    else if (period === 'week') start.setDate(now.getDate() - 7);
    else if (period === 'month') start.setDate(now.getDate() - 31);
    else start.setFullYear(2000);
    const needle = q.trim().toLowerCase();
    return all.filter((e) => {
      const d = new Date(e.date);
      if (Number.isFinite(d.getTime()) && d < start) return false;
      if (type === 'debit' && !(Number(e.debit) > 0)) return false;
      if (type === 'credit' && !(Number(e.credit) > 0)) return false;
      if (needle && !`${e.reference} ${e.description}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data?.entries, period, type, q]);

  if (meLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (meError || isError || !me?.customerId) {
    return (
      <ErrorState
        title={t('statement')}
        description={tCommon('loadFailed')}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        tone="soft"
        title={t('statement')}
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              window.open(`${API_URL}/api/v1/statements/${me.customerId}/pdf`, '_blank')
            }
          >
            PDF
          </Button>
        }
      />

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
        onClear={() => setType('all')}
      >
        {(['all', 'debit', 'credit'] as const).map((id) => (
          <FilterChip key={id} selected={type === id} onClick={() => setType(id)}>
            {id === 'all' ? tCommon('all') : id === 'debit' ? tAcc('colDebit') : tAcc('colCredit')}
          </FilterChip>
        ))}
      </FilterPanel>

      {!data?.entries?.length ? (
        <MotionSection>
          <EmptyState
            title={tAcc('statementEmpty')}
            description={tAcc('statementEmptyHint')}
          />
        </MotionSection>
      ) : (
        <>
          <MotionSection delayMs={40}>
            <Alert variant="info">
              {tAcc('closingAsOf', {
                date: data.asOf.slice(0, 10),
                balance: String(data.closingBalance),
                currency: data.currency,
              })}
            </Alert>
          </MotionSection>
          <MotionSection delayMs={80}>
            <Card title={t('statement')} padded={false} className="maher-form-section">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{tAcc('colDate')}</TableHeaderCell>
                    <TableHeaderCell>{tAcc('colRef')}</TableHeaderCell>
                    <TableHeaderCell>{tAcc('colDescription')}</TableHeaderCell>
                    <TableHeaderCell>{tAcc('colDebit')}</TableHeaderCell>
                    <TableHeaderCell>{tAcc('colCredit')}</TableHeaderCell>
                    <TableHeaderCell>{tAcc('colBalance')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={`${e.reference}-${e.date}`}>
                      <TableCell>{e.date.slice(0, 10)}</TableCell>
                      <TableCell>{e.reference}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>{e.debit}</TableCell>
                      <TableCell>{e.credit}</TableCell>
                      <TableCell>{e.balance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </MotionSection>
        </>
      )}
    </div>
  );
}
