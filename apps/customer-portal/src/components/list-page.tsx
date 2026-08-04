'use client';

import { apiFetch } from '@/lib/api-client';
import {
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
  TableSkeleton,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface ListPageProps<T> {
  title: string;
  description?: string;
  queryKey: string[];
  fetchPath: string;
  columns: Column<T>[];
  emptyTitle: string;
  emptyDescription?: string;
  actions?: ReactNode;
}

export function ListPage<T extends { id: string }>({
  title,
  description,
  queryKey,
  fetchPath,
  columns,
  emptyTitle,
  emptyDescription,
  actions,
}: ListPageProps<T>) {
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const json = await apiFetch<{ data?: T[] } | T[]>(fetchPath);
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <TableSkeleton columns={columns.length} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={title}
        description={tCommon('loadFailed')}
        onRetry={() => refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHero tone="soft" title={title} description={description} actions={actions} />
      {rows.length === 0 ? (
        <MotionSection>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </MotionSection>
      ) : (
        <MotionSection delayMs={60}>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableHeaderCell key={col.key}>{col.header}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>{col.render(row)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MotionSection>
      )}
    </div>
  );
}
