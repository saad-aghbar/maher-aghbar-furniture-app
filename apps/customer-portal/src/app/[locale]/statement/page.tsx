'use client';

import { apiFetch, API_URL } from '@/lib/api-client';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  MotionSection,
  PageHero,
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

  const { data: me, isLoading: meLoading, isError: meError } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<{ customerId?: string }>('/api/v1/auth/me'),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['statement', me?.customerId],
    enabled: Boolean(me?.customerId),
    queryFn: () => apiFetch<Statement>(`/api/v1/statements/${me!.customerId}`),
  });

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

      {!data?.entries?.length ? (
        <MotionSection>
          <EmptyState
            title="No ledger entries"
            description="Invoices and payments will appear here."
          />
        </MotionSection>
      ) : (
        <>
          <MotionSection delayMs={40}>
            <Alert variant="info">
              Closing balance as of {data.asOf.slice(0, 10)}: {data.closingBalance} {data.currency}
            </Alert>
          </MotionSection>
          <MotionSection delayMs={80}>
            <Card title="Statement of account" padded={false} className="maher-form-section">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Ref</TableHeaderCell>
                    <TableHeaderCell>Description</TableHeaderCell>
                    <TableHeaderCell>Debit</TableHeaderCell>
                    <TableHeaderCell>Credit</TableHeaderCell>
                    <TableHeaderCell>Balance</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.entries.map((e) => (
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
