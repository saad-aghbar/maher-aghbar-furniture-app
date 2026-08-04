'use client';

import { apiFetch } from '@/lib/api-client';
import { Link } from '@/i18n/navigation';
import {
  EmptyState,
  ErrorState,
  MotionSection,
  PageHero,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSkeleton,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface ContractRow {
  id: string;
  number: string;
  status: string;
  contractValue: string | number;
  startDate?: string | null;
  endDate?: string | null;
  salesOrder?: { id: string; number: string } | null;
}

export default function ContractsPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-contracts'],
    queryFn: async () => {
      const json = await apiFetch<{ data: ContractRow[] } | ContractRow[]>(
        '/api/v1/contracts?pageSize=50',
      );
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <TableSkeleton columns={5} />
      </div>
    );
  }
  if (isError) {
    return <ErrorState title={t('contracts')} onRetry={() => refetch()} />;
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHero tone="soft" title={t('contracts')} description={tCommon('contractsSubtitle')} />
      {rows.length === 0 ? (
        <MotionSection>
          <EmptyState title={tCommon('emptyList')} description={tCommon('contractsEmptyHint')} />
        </MotionSection>
      ) : (
        <MotionSection delayMs={60}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
                <TableHeaderCell>{tc('salesOrder')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('date')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium" dir="ltr">
                    {row.number}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell dir="ltr">{Number(row.contractValue).toFixed(2)}</TableCell>
                  <TableCell>
                    {row.salesOrder ? (
                      <Link
                        href={`/orders/${row.salesOrder.id}`}
                        className="font-medium text-brand hover:underline"
                        dir="ltr"
                      >
                        {row.salesOrder.number}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell dir="ltr">
                    {(row.startDate ?? row.endDate)?.toString().slice(0, 10) ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MotionSection>
      )}
    </div>
  );
}
